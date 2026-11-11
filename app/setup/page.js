import SetupForm from "./setup-form";

export const metadata = { title: "Company setup | Hardware Service CRM" };

export default function SetupPage() {
  // The setup secret is validated by the server API, never in browser code.
  return <SetupForm />;
}
