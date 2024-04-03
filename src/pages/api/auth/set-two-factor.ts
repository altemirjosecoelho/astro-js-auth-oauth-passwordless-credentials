import type { APIContext } from "astro";
import { customAlphabet } from "nanoid";
import { authenticator } from "otplib";
import prisma from "../../../database";


export async function POST({ request, cookies }: APIContext) {
  const generateId = customAlphabet("0123456789abcdefghijklmnopqrstuvwxyz", 4);

  try {
    const { secretCode, enteredCode } = await request.json();

    if (
      !secretCode ||
      !enteredCode ||
      enteredCode.length != 6 ||
      secretCode.length != 32
    ) {
      return Response.json(
        {
          error: "validation_error",
        },
        { status: 400 }
      );
    }

    const authToken = cookies.get("app_auth_token")?.value;

    if (!authToken) {
      return Response.json(
        { error: "authentication_error", message: "Log in" },
        {
          status: 401,
        }
      );
    }

    const sessionInfo = await prisma.session.findFirst({
      where: {
        id: authToken,
        expiresAt: {
          gte: new Date().getTime()
        }
      },
      include: {
        user: true
      }
    });

    if (!sessionInfo || !sessionInfo.user) {
      return Response.json(
        { error: "authorization_error", message: "Log in" },
        {
          status: 403,
        }
      );
    }

    const isValidToken = authenticator.verify({
      token: enteredCode,
      secret: secretCode,
    });

    const userId = sessionInfo.user.id;

    if (isValidToken) {
      await prisma.user.update({
        where: {
          id: userId,
        },
        data: {
          twoFactorEnabled: true,
          twoFactorSecret: secretCode,
        },
      });

      const exisitingCode = await prisma.recoveryCode.findMany({
        where: {
          userId: userId,
          isUsed: false,
        },
        select: {
          code: true,
        },
      });

      let codes: string[] = [];
      if (exisitingCode.length > 0) {
        exisitingCode.forEach((code: { code: string }) => {
          codes.push(code.code);
        });
      }
      if (exisitingCode.length <= 0) {
        for (let i = 0; i < 6; i++) {
          const code = `${generateId()}-${generateId()}-${generateId()}`;
          codes.push(code);
        }
        await prisma.recoveryCode.createMany({
          data: [
            { userId, code: codes[0] },
            { userId, code: codes[1] },
            { userId, code: codes[2] },
            { userId, code: codes[3] },
            { userId, code: codes[4] },
            { userId, code: codes[5] },
          ]
        });
      }

      return Response.json({
        success: true,
        data: {
          codes,
        },
      });
    } else {
      return Response.json(
        {
          error: "verification_error",
          message:
            "Error while verifying two factor code. Enter new code and try again. If error persists then remove the account from app and also refresh this page.",
        },
        { status: 400 }
      );
    }
  } catch (err) {
    console.log("Error while verifying two factor", err);
    return Response.json(
      {
        error: "server_error",
        message: "Internal server Error. Please try again later",
      },
      { status: 500 }
    );
  }
}
