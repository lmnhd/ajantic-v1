import TestServerAction from "@/components/TestServerAction";

export const metadata = {
  title: 'Test Server Actions',
  description: 'A page to test server actions',
};

export default function TestActionsPage() {
  return (
    <div className="container mx-auto py-8">
      <h1 className="text-2xl font-bold mb-6">Server Actions Test Page</h1>
      <p className="mb-4">
        This page is used to test if server actions are working properly with the
        encryption key configuration.
      </p>
      <TestServerAction />
    </div>
  );
} 