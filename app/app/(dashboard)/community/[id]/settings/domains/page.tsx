import prisma from "@/lib/prisma";
import Form from "@/components/form";
import { updateCommunity } from "@/lib/actions";

export default async function CommunitySettingsDomains({
  params,
}: {
  params: { id: string };
}) {
  const data = await prisma.community.findUnique({
    where: {
      id: decodeURIComponent(params.id),
    },
  });

  return (
    <div className="flex flex-col space-y-6">
      <Form
        title="Subdomain"
        description="The subdomain for your Community."
        helpText="Please use 32 characters maximum."
        inputAttrs={{
          name: "subdomain",
          type: "text",
          defaultValue: data?.subdomain!,
          placeholder: "subdomain",
          maxLength: 32,
        }}
        handleSubmit={updateCommunity}
      />
      <Form
        title="Custom Domain"
        description="The custom domain for your Community."
        helpText="Please enter a valid domain."
        inputAttrs={{
          name: "customDomain",
          type: "text",
          defaultValue: data?.customDomain!,
          placeholder: "yourdomain.com",
          maxLength: 64,
          pattern: "^[a-z0-9]+([\\-\\.]{1}[a-z0-9]+)*\\.[a-z]{2,5}$",
        }}
        handleSubmit={updateCommunity}
      />
    </div>
  );
}
