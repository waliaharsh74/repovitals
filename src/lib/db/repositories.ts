import { prisma } from "@/lib/db/prisma";

export async function upsertRepository(input: {
  owner: string;
  name: string;
  url: string;
  defaultBranch?: string;
}) {
  return prisma.repository.upsert({
    where: {
      owner_name: {
        owner: input.owner,
        name: input.name,
      },
    },
    create: {
      owner: input.owner,
      name: input.name,
      url: input.url,
      defaultBranch: input.defaultBranch,
    },
    update: {
      url: input.url,
      defaultBranch: input.defaultBranch,
    },
  });
}
