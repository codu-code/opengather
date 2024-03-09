import prisma from "@/lib/prisma";
import Form from "@/components/form";
import { updateCommunity } from "@/lib/actions";
import DeleteCommunityForm from "@/components/form/delete-community-form";

export default async function CommunitySettingsIndex({
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
        title="Name"
        description="The name of your Community. This will be used as the meta title on Google as well."
        helpText="Please use 32 characters maximum."
        inputAttrs={{
          name: "name",
          type: "text",
          defaultValue: data?.name!,
          placeholder: "My Awesome Community",
          maxLength: 32,
        }}
        handleSubmit={updateCommunity}
      />

      <Form
        title="Description"
        description="The description of your Community. This will be used as the meta description on Google as well."
        helpText="Include SEO-optimized keywords that you want to rank for."
        inputAttrs={{
          name: "description",
          type: "text",
          defaultValue: data?.description!,
          placeholder: "A blog about really interesting things.",
        }}
        handleSubmit={updateCommunity}
      />

      <DeleteCommunityForm communityName={data?.name!} />
    </div>
  );
}
