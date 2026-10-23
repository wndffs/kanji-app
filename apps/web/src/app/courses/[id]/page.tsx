import { CourseExplorer } from "../CourseExplorer";

export default async function CourseExplorerPage({ params }: { readonly params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <CourseExplorer courseId={id} />;
}
