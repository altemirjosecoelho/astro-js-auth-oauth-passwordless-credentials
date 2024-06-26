import type { APIContext } from "astro";
import redis from "../../../lib/redis";
import EmailVerificationSchema from "../../../validations/email-verification";
import prisma from "../../../database";

export async function POST({ request }: APIContext) {
  const { id, code } = await request.json();

  try {
    const parsedData = EmailVerificationSchema.safeParse({
      id,
      code,
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

    const data: string | null = await redis.get(id);

    if (!data) {
      return Response.json(
        {
          error: "code_expired",
          message:
            "Verification code expired. Please generate a new verification code.",
        },
        { status: 400 }
      );
    }

    const [otp, email] = data.split(":");

    if (otp !== code) {
      return Response.json(
        {
          error: "invalid_code",
          message: "Please check your entered code",
        },
        { status: 400 }
      );
    }

    await prisma.user.update({
      where: {
        email: email,
      },
      data: {
        emailVerified: true,
      },
    });

    await redis.del(id);

    return Response.json({
      data: { emailVerified: true },
      message: "Email Verified",
    });
  } catch (error) {
    console.log("error while verifying email", false);
    return Response.json({ success: false });
  }
}
