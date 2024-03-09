import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import EventCard from "./event-card";
import Image from "next/image";

export default async function Events({
  communityId,
  limit,
}: {
  communityId?: string;
  limit?: number;
}) {
  const session = await getSession();
  if (!session?.user) {
    redirect("/login");
  }
  const events = await prisma.event.findMany({
    where: {
      userId: session.user.id as string,
      ...(communityId ? { communityId } : {}),
    },
    orderBy: {
      updatedAt: "desc",
    },
    include: {
      community: true,
    },
    ...(limit ? { take: limit } : {}),
  });

  return events.length > 0 ? (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {events.map((event) => (
        <EventCard key={event.id} data={event} />
      ))}
    </div>
  ) : (
    <div className="flex flex-col items-center space-x-4">
      <h1 className="font-cal text-4xl">No Events Yet</h1>
      <Image
        alt="missing event"
        src="https://illustrations.popsy.co/gray/graphic-design.svg"
        width={400}
        height={400}
      />
      <p className="text-lg text-stone-500">
        You do not have any events yet. Create one to get started.
      </p>
    </div>
  );
}
