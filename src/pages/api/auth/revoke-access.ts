import type { APIContext } from "astro";
import prisma from "../../../database";

export async function POST({ request }: APIContext) {
  const { sessionId }: { sessionId: string } = await request.json();

  try {
    await prisma.session.deleteMany({
      where: {
        id: sessionId,
      },
    });
    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ success: false }, { status: 500 });
  }
}
