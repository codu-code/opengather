import { headers } from "next/headers";
import { getEventsForCommunity } from "@/lib/fetchers";

export default async function Communitymap() {
  const headersList = headers();
  const domain =
    headersList
      .get("host")
      ?.replace(".localhost:3000", `.${process.env.NEXT_PUBLIC_ROOT_DOMAIN}`) ??
    "vercel.pub";

  const events = await getEventsForCommunity(domain);

  return [
    {
      url: `https://${domain}`,
      lastModified: new Date(),
    },
    ...events.map(({ slug }) => ({
      url: `https://${domain}/${slug}`,
      lastModified: new Date(),
    })),
  ];
}
