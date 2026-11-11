import "./globals.css";

export const metadata = {
  title: "Hardware Service CRM",
  description: "Multi-company CRM for computer hardware service businesses."
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
