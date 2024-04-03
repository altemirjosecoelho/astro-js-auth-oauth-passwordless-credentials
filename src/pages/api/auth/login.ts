import type { APIContext } from "astro";
import bcrypt from "bcryptjs";
import {
  create2FASession,
  createLoginLog,
  createSession,
} from "../../../lib/auth";
import LoginSchema from "../../../validations/login";
import prisma from "../../../database";

export async function POST({ request, cookies }: APIContext) {
  try {
    const { email, password }: { email: string; password: string } =
      await request.json();
    const parsedData = LoginSchema.safeParse({
      email: email,
      password: password,
    });

    if (!parsedData.success) {
      return Response.json(
        {
          error: "validation_error",
          message: parsedData.error.format(),
        },
        { status: 400 }
      );
    }

    const userExists = await prisma.user.findFirst({
      where: {
        email: email,
      },
    });

    const passwordExists = await prisma.password.findFirst({
      where: {
        userId: userExists?.id ?? "SomeThingRandom",
      },
    });

    // match password
    const passwordMatch = await bcrypt.compare(
      password,
      passwordExists?.password ??
        "$2a$10$mqgl5wfEnNtGQurbRDL.seQZRxY0Dhqc/RVoNtV01wzAMmYRfjvyW"
    );

    if (!passwordMatch || !userExists) {
      return Response.json(
        {
          error: "auth_error",
          message: "Incorrect email or password",
        },
        { status: 401 }
      );
    }

    if (userExists.twoFactorEnabled) {
      const faSess = await create2FASession(userExists.id);

      cookies.set("2fa_auth", faSess, {
        path: "/",
        httpOnly: true,
        sameSite: "lax",
        secure: import.meta.env.PROD,
      });

      return Response.json(
        { message: "2FA required", redirect: "/verify-two-factor" },
        {
          status: 302,
        }
      );
    }

    const { sessionId, expiresAt } = await createSession({
      userId: userExists.id,
    });

    // log
    await createLoginLog({
      sessionId,
      userAgent: request.headers.get("user-agent"),
      userId: userExists.id,
      ip: request.headers.get("x-real-ip") ?? "dev",
    });

    return Response.json(
      { message: "Logged In Successfully", redirect: "/dashboard" },
      {
        status: 200,
        headers: {
          "Set-Cookie": `app_auth_token=${sessionId}; Path=/; HttpOnly; SameSite=Lax;Expires=${expiresAt.toUTCString()}; Secure=${
            import.meta.env.PROD
          }`,
        },
      }
    );
  } catch (error) {
    console.log("Error while signup", error);
    return Response.json(
      { error: "server_error", message: "Server Error" },
      { status: 500 }
    );
  }
}
