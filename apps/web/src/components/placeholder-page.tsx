import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";

export function PlaceholderPage({ title }: { title: string }) {
  return (
    <>
      <PageHeader
        title={title}
        description="Esta seccion quedara lista en la siguiente etapa del frontend."
      />
      <Card>
        <CardContent className="py-10 text-sm text-muted-foreground">
          Proximamente
        </CardContent>
      </Card>
    </>
  );
}
