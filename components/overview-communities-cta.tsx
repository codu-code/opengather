import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import CreateCommunityButton from "./create-community-button";
import CreateCommunityModal from "./modal/create-community";
import Link from "next/link";

export default async function OverviewCommunitiesCTA() {
  const session = await getSession();
  if (!session) {
    return 0;
  }
  const communities = await prisma.community.count({
    where: {
      userId: session.user.id as string,
    },
  });

  return communities > 0 ? (
    <Link
      href="/communities"
      className="rounded-lg border border-black bg-black px-4 py-1.5 text-sm font-medium text-white transition-all hover:bg-white hover:text-black active:bg-stone-100 dark:border-stone-700 dark:hover:border-stone-200 dark:hover:bg-black dark:hover:text-white dark:active:bg-stone-800"
    >
      View All Communities
    </Link>
  ) : (
    <CreateCommunityButton>
      <CreateCommunityModal />
    </CreateCommunityButton>
  );
}
