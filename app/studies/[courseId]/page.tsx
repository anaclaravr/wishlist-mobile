import { notFound } from "next/navigation";
import { BookOpen, Home } from "lucide-react";

import { AdminAccessGate } from "@/components/admin-access-gate";
import { AdminLayout } from "@/components/admin-layout";
import { AdminStudiesDashboard } from "@/components/admin-studies-dashboard";
import { StudyCourseTitleEditor } from "@/components/study-course-title-editor";
import { getAdminPageData } from "@/lib/admin-hub-data";
import { listStudyData } from "@/lib/access-db";

export const dynamic = "force-dynamic";

export default async function StudyCoursePage({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const data = await getAdminPageData();

  if (!data) {
    return <AdminAccessGate />;
  }

  const { courseId } = await params;
  const studiesData = await listStudyData({ wishlistId: data.hub.wishlist.id });
  const course = studiesData.courses.find((currentCourse) => currentCourse.id === courseId);

  if (!course) {
    notFound();
  }

  return (
    <AdminLayout
      wishlist={data.hub.wishlist}
      wishlistHref={data.wishlistHref}
      activePage="studies"
      title={<StudyCourseTitleEditor course={course} backHref="/studies" />}
      compactHeader
      breadcrumbItems={[
        { label: "Home", href: data.wishlistHref, icon: <Home aria-hidden="true" /> },
        { label: "Estudos", href: "/studies", icon: <BookOpen aria-hidden="true" /> },
        { label: course.title, icon: <BookOpen aria-hidden="true" /> },
      ]}
    >
      <AdminStudiesDashboard initialData={studiesData} courseId={courseId} />
    </AdminLayout>
  );
}
