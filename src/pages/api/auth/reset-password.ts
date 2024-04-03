import type { APIContext } from "astro";
import bcrypt from "bcryptjs";
import redis from "../../../lib/redis";
import PasswordSchema from "../../../validations/password";
import prisma from "../../../database";

export async function POST({ request }: APIContext) {
  const { id, password }: { id: string; password: string } =
    await request.json();

  const parsedData = PasswordSchema.safeParse(password);

  if (!parsedData.success) {
    return Response.json(
      {
        error: "validation_error",
        message: parsedData.error.format(),
      },
      { status: 400 }
    );
  }

  if (!id) {
    return Response.json(
      {
        error: "id_error",
        message: "Please pass a valid ID",
      },
      { status: 400 }
    );
  }

  try {
    const userInfo: string | null = await redis.get(id);

    if (!userInfo) {
      return Response.json(
        {
          error: "token_error",
          message: "Token expired. Please regenerate",
        },
        { status: 400 }
      );
    }

    const userExists = await prisma.user.findFirst({
      where: {
        email: userInfo,
        isBlocked: false,
        isDeleted: false
      },
      select: {
        id: true,
        email: true,
      },
    });

    if (!userExists) {
      return Response.json(
        {
          error: "token_error",
          message: "Token expired. Please regenerate",
        },
        { status: 400 }
      );
    }

    const hashedPassword = await bcrypt.hash(parsedData.data, 10);
    const updatedUser = await prisma.user.update({
      where: {
        id: userExists.id,
      },
      include: {
        password: true,
      },
      data: {
        password: {
          create: {
            password: hashedPassword,
          },
        },
      },
    });

    if (updatedUser) {
      return Response.json({ success: true }, { status: 200 });
    } else {
      return Response.json({ error: "server_error" }, { status: 500 });
    }
  } catch (err) {
    console.log("Error while reset password", err);
    return Response.json({ error: "server_error" }, { status: 500 });
  }
}
