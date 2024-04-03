import prisma from "../database";

async function getUser(authToken: string | undefined) {
  if (!authToken) return null;

  const userInfo = await prisma.session.findFirst({
    where: {
      id: authToken,
      expiresAt: {
        gte: new Date().getTime()
      }
    },
    select: {
      id: true,
      user: {
        select: {
          id: true,
          fullName: true,
          userName: true,
        },
      },
    },
  });

  if (!userInfo) {
    return null;
  }

  if (!userInfo.user) {
    return null;
  }
  return userInfo;
}

export default getUser;
