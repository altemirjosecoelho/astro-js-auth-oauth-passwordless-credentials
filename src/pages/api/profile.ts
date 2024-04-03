import type { APIContext } from "astro";
import prisma from "../../database";

export async function POST({ request, cookies }: APIContext) {
  const requestBody = await request.formData();

  const fullName = requestBody.get("fullName");
  const userName = requestBody.get("userName");
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

    await prisma.user.update({
      where: {
        id: sessionInfo.user?.id,
      },
      data: {
        fullName: fullName as string,
        userName: userName as string,
      },
    });

    return Response.json(
      { success: true, message: "Perfil atualizado com sucesso" },
      {
        status: 200,
      }
    );
  } catch (error) {
    console.log("error while creating profile", error);

    return Response.json(
      {
        error: "server_error",
        message: "Internal server error. Try again later",
      },
      { status: 500 }
    );
  }
}
