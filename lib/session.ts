import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function requireUser() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    redirect("/login");
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, disabledAt: true, emailVerifiedAt: true, sessionVersion: true }
  });
  if (
    !user ||
    user.disabledAt ||
    !user.emailVerifiedAt ||
    user.sessionVersion !== session.user.sessionVersion
  ) {
    redirect("/login");
  }

  return session.user;
}
