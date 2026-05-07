import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";

export type CurrentUser = {
  id: string;
  name?: string | null;
  email?: string | null;
  image?: string | null;
};

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return null;
  }

  return {
    id: session.user.id,
    name: session.user.name,
    email: session.user.email,
    image: session.user.image,
  };
}
