import { redirect } from "next/navigation";

export default async function HomePage({
  searchParams,
}: {
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = searchParams ? await searchParams : undefined;
  const tour = params?.tour;

  if (tour) {
    redirect(`/activity?tour=${tour}`);
  }

    redirect("/activity");
  }
