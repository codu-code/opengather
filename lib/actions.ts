"use server";

import prisma from "@/lib/prisma";
import { Event, Community } from "@prisma/client";
import { revalidateTag } from "next/cache";
import { withEventAuth, withCommunityAuth } from "./auth";
import { getSession } from "@/lib/auth";
import {
  addDomainToVercel,
  // getApexDomain,
  removeDomainFromVercelProject,
  // removeDomainFromVercelTeam,
  validDomainRegex,
} from "@/lib/domains";
import { put } from "@vercel/blob";
import { customAlphabet } from "nanoid";
import { getBlurDataURL } from "@/lib/utils";

const nanoid = customAlphabet(
  "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz",
  7,
); // 7-character random string

export const createCommunity = async (formData: FormData) => {
  const session = await getSession();
  if (!session?.user.id) {
    return {
      error: "Not authenticated",
    };
  }
  const name = formData.get("name") as string;
  const description = formData.get("description") as string;
  const subdomain = formData.get("subdomain") as string;

  try {
    const response = await prisma.community.create({
      data: {
        name,
        description,
        subdomain,
        user: {
          connect: {
            id: session.user.id,
          },
        },
      },
    });
    await revalidateTag(
      `${subdomain}.${process.env.NEXT_PUBLIC_ROOT_DOMAIN}-metadata`,
    );
    return response;
  } catch (error: any) {
    if (error.code === "P2002") {
      return {
        error: `This subdomain is already taken`,
      };
    } else {
      return {
        error: error.message,
      };
    }
  }
};

export const updateCommunity = withCommunityAuth(
  async (formData: FormData, community: Community, key: string) => {
    const value = formData.get(key) as string;

    try {
      let response;

      if (key === "customDomain") {
        if (value.includes("vercel.pub")) {
          return {
            error: "Cannot use vercel.pub subdomain as your custom domain",
          };

          // if the custom domain is valid, we need to add it to Vercel
        } else if (validDomainRegex.test(value)) {
          response = await prisma.community.update({
            where: {
              id: community.id,
            },
            data: {
              customDomain: value,
            },
          });
          await Promise.all([
            addDomainToVercel(value),
            // Optional: add www subdomain as well and redirect to apex domain
            // addDomainToVercel(`www.${value}`),
          ]);

          // empty value means the user wants to remove the custom domain
        } else if (value === "") {
          response = await prisma.community.update({
            where: {
              id: community.id,
            },
            data: {
              customDomain: null,
            },
          });
        }

        // if the community had a different customDomain before, we need to remove it from Vercel
        if (community.customDomain && community.customDomain !== value) {
          response = await removeDomainFromVercelProject(community.customDomain);

          /* Optional: remove domain from Vercel team 

          // first, we need to check if the apex domain is being used by other communitiess
          const apexDomain = getApexDomain(`https://${community.customDomain}`);
          const domainCount = await prisma.community.count({
            where: {
              OR: [
                {
                  customDomain: apexDomain,
                },
                {
                  customDomain: {
                    endsWith: `.${apexDomain}`,
                  },
                },
              ],
            },
          });

          // if the apex domain is being used by other communitiess
          // we should only remove it from our Vercel project
          if (domainCount >= 1) {
            await removeDomainFromVercelProject(community.customDomain);
          } else {
            // this is the only community using this apex domain
            // so we can remove it entirely from our Vercel team
            await removeDomainFromVercelTeam(
              community.customDomain
            );
          }
          
          */
        }
      } else if (key === "image" || key === "logo") {
        if (!process.env.BLOB_READ_WRITE_TOKEN) {
          return {
            error:
              "Missing BLOB_READ_WRITE_TOKEN token. Note: Vercel Blob is currently in beta – please fill out this form for access: https://tally.so/r/nPDMNd",
          };
        }

        const file = formData.get(key) as File;
        const filename = `${nanoid()}.${file.type.split("/")[1]}`;

        const { url } = await put(filename, file, {
          access: "public",
        });

        const blurhash = key === "image" ? await getBlurDataURL(url) : null;

        response = await prisma.community.update({
          where: {
            id: community.id,
          },
          data: {
            [key]: url,
            ...(blurhash && { imageBlurhash: blurhash }),
          },
        });
      } else {
        response = await prisma.community.update({
          where: {
            id: community.id,
          },
          data: {
            [key]: value,
          },
        });
      }
      console.log(
        "Updated community data! Revalidating tags: ",
        `${community.subdomain}.${process.env.NEXT_PUBLIC_ROOT_DOMAIN}-metadata`,
        `${community.customDomain}-metadata`,
      );
      await revalidateTag(
        `${community.subdomain}.${process.env.NEXT_PUBLIC_ROOT_DOMAIN}-metadata`,
      );
      community.customDomain &&
        (await revalidateTag(`${community.customDomain}-metadata`));

      return response;
    } catch (error: any) {
      if (error.code === "P2002") {
        return {
          error: `This ${key} is already taken`,
        };
      } else {
        return {
          error: error.message,
        };
      }
    }
  },
);

export const deleteCommunity = withCommunityAuth(async (_: FormData, community: Community) => {
  try {
    const response = await prisma.community.delete({
      where: {
        id: community.id,
      },
    });
    await revalidateTag(
      `${community.subdomain}.${process.env.NEXT_PUBLIC_ROOT_DOMAIN}-metadata`,
    );
    response.customDomain &&
      (await revalidateTag(`${community.customDomain}-metadata`));
    return response;
  } catch (error: any) {
    return {
      error: error.message,
    };
  }
});

export const getCommunityFromEventId = async (eventId: string) => {
  const event = await prisma.event.findUnique({
    where: {
      id: eventId,
    },
    select: {
      communityId: true,
    },
  });
  return event?.communityId;
};

export const createEvent = withCommunityAuth(async (_: FormData, community: Community) => {
  const session = await getSession();
  if (!session?.user.id) {
    return {
      error: "Not authenticated",
    };
  }
  const response = await prisma.event.create({
    data: {
      communityId: community.id,
      userId: session.user.id,
    },
  });

  await revalidateTag(
    `${community.subdomain}.${process.env.NEXT_PUBLIC_ROOT_DOMAIN}-events`,
  );
  community.customDomain && (await revalidateTag(`${community.customDomain}-events`));

  return response;
});

// creating a separate function for this because we're not using FormData
export const updateEvent = async (data: Event) => {
  const session = await getSession();
  if (!session?.user.id) {
    return {
      error: "Not authenticated",
    };
  }
  const event = await prisma.event.findUnique({
    where: {
      id: data.id,
    },
    include: {
      community: true,
    },
  });
  if (!event || event.userId !== session.user.id) {
    return {
      error: "Event not found",
    };
  }
  try {
    const response = await prisma.event.update({
      where: {
        id: data.id,
      },
      data: {
        title: data.title,
        description: data.description,
        content: data.content,
      },
    });

    await revalidateTag(
      `${event.community?.subdomain}.${process.env.NEXT_PUBLIC_ROOT_DOMAIN}-events`,
    );
    await revalidateTag(
      `${event.community?.subdomain}.${process.env.NEXT_PUBLIC_ROOT_DOMAIN}-${event.slug}`,
    );

    // if the community has a custom domain, we need to revalidate those tags too
    event.community?.customDomain &&
      (await revalidateTag(`${event.community?.customDomain}-events`),
      await revalidateTag(`${event.community?.customDomain}-${event.slug}`));

    return response;
  } catch (error: any) {
    return {
      error: error.message,
    };
  }
};

export const updateEventMetadata = withEventAuth(
  async (
    formData: FormData,
    event: Event & {
      community: Community;
    },
    key: string,
  ) => {
    const value = formData.get(key) as string;

    try {
      let response;
      if (key === "image") {
        const file = formData.get("image") as File;
        const filename = `${nanoid()}.${file.type.split("/")[1]}`;

        const { url } = await put(filename, file, {
          access: "public",
        });

        const blurhash = await getBlurDataURL(url);

        response = await prisma.event.update({
          where: {
            id: event.id,
          },
          data: {
            image: url,
            imageBlurhash: blurhash,
          },
        });
      } else {
        response = await prisma.event.update({
          where: {
            id: event.id,
          },
          data: {
            [key]: key === "published" ? value === "true" : value,
          },
        });
      }

      await revalidateTag(
        `${event.community?.subdomain}.${process.env.NEXT_PUBLIC_ROOT_DOMAIN}-events`,
      );
      await revalidateTag(
        `${event.community?.subdomain}.${process.env.NEXT_PUBLIC_ROOT_DOMAIN}-${event.slug}`,
      );

      // if the community has a custom domain, we need to revalidate those tags too
      event.community?.customDomain &&
        (await revalidateTag(`${event.community?.customDomain}-events`),
        await revalidateTag(`${event.community?.customDomain}-${event.slug}`));

      return response;
    } catch (error: any) {
      if (error.code === "P2002") {
        return {
          error: `This slug is already in use`,
        };
      } else {
        return {
          error: error.message,
        };
      }
    }
  },
);

export const deleteEvent = withEventAuth(async (_: FormData, event: Event) => {
  try {
    const response = await prisma.event.delete({
      where: {
        id: event.id,
      },
      select: {
        communityId: true,
      },
    });
    return response;
  } catch (error: any) {
    return {
      error: error.message,
    };
  }
});

export const editUser = async (
  formData: FormData,
  _id: unknown,
  key: string,
) => {
  const session = await getSession();
  if (!session?.user.id) {
    return {
      error: "Not authenticated",
    };
  }
  const value = formData.get(key) as string;

  try {
    const response = await prisma.user.update({
      where: {
        id: session.user.id,
      },
      data: {
        [key]: value,
      },
    });
    return response;
  } catch (error: any) {
    if (error.code === "P2002") {
      return {
        error: `This ${key} is already in use`,
      };
    } else {
      return {
        error: error.message,
      };
    }
  }
};
