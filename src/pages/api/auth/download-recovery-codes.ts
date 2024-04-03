import type { APIContext } from "astro";
import prisma from "../../../database";


export async function GET({ cookies }: APIContext) {
  try {
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
        AND: [
          { id: authToken },
          { expiresAt: { gte: new Date().getTime() } }
        ]
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

    const exisitingCode = await prisma.recoveryCode.findMany({
      where: {
        AND: [
          { userId: sessionInfo.user.id },
          { isUsed: false }
        ]
      }
    });

    if (exisitingCode.length < 1) {
      return Response.json(
        {
          error: "not_found",
          message: "No codes exists for the user.",
        },
        { status: 404 }
      );
    }

    let codes: string[] = [];
    if (exisitingCode.length > 0) {
      exisitingCode.forEach((code: { code: string }) => {
        codes.push(code.code);
      });
    }
    return new Response(codes.join("\n"), {
      headers: {
        "Content-Disposition": "attachment; filename=astro-auth-codes.txt",
        "Content-Type": "text/plain",
      },
    });
  } catch (error) {
    console.log("error while downloading", error);
    return Response.json(
      {
        error: "server_error",
        message: "Error while downloading code",
      },
      { status: 500 }
    );
  }
}
