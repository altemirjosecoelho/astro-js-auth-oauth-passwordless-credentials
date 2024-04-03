import type { APIContext } from "astro";
import prisma from "../../../database";

export async function GET({ cookies }: APIContext) {
  const sessionId = cookies.get("app_auth_token")?.value;
  if (!sessionId) {
    return new Response(null, {
      status: 302,
      headers: {
        Location: "/",
      },
    });
  }
  await prisma.session.deleteMany({
    where: {
      id: sessionId,
    },
  });

  cookies.delete("app_auth_token", {
    path: "/",
  });

  return new Response(null, {
    status: 302,
    headers: {
      Location: "/",
    },
  });
}
