import type { APIContext } from "astro";
import { authenticator } from "otplib";
import redis from "../../../lib/redis";
import { createLoginLog, createSession } from "../../../lib/auth";
import prisma from "../../../database";

export async function POST({ request, cookies }: APIContext) {
  try {
    const { enteredCode } = await request.json();

    if (!enteredCode || enteredCode.length != 6) {
      return Response.json(
        {
          error: "validation_error",
          message: "Enter a valid 6 digit code",
        },
        { status: 400 }
      );
    }

    const authToken = cookies.get("2fa_auth")?.value;

    if (!authToken) {
      return Response.json(
        { error: "authentication_error", message: "Log in" },
        {
          status: 401,
        }
      );
    }

    const userId = await redis.get(`2fa_auth:${authToken}`);

    if (!userId) {
      return Response.json(
        { error: "authentication_error", message: "Log in" },
        {
          status: 401,
        }
      );
    }

    const userExists = await prisma.user.findFirst({
      where: {
        id: userId as string,
      },
    });

    if (!userExists) {
      return Response.json(
        { error: "authorization_error", message: "Log in" },
        {
          status: 403,
        }
      );
    }

    const isValidToken = authenticator.verify({
      token: enteredCode,
      secret: userExists.twoFactorSecret!,
    });

    if (isValidToken) {
      const { sessionId, expiresAt } = await createSession({
        userId: userExists.id,
      });

      await createLoginLog({
        sessionId,
        userAgent: request.headers.get("user-agent"),
        userId: userExists.id,
        ip: request.headers.get("x-real-ip") ?? "dev",
      });

      cookies.delete("2fa_auth", { path: "/" });

      cookies.set("app_auth_token", sessionId, {
        path: "/",
        httpOnly: true,
        expires: expiresAt,
        secure: import.meta.env.PROD,
        sameSite: "lax",
      });

      await redis.del(`2fa_auth:${authToken}`);

      return Response.json(
        { message: "Logged In Successfully", redirect: "/dashboard" },
        {
          status: 200,
        }
      );
    } else {
      return Response.json(
        {
          error: "verification_error",
          message:
            "Error while verifying multi factor code. Enter new code and try again.",
        },
        { status: 400 }
      );
    }
  } catch (err) {
    console.log("Error while verifying multi factor", err);
    return Response.json(
      {
        error: "server_error",
        message: "Internal server Error. Please try again later",
      },
      { status: 500 }
    );
  }
}
