import "./globals.css";

export const metadata = {
  title: "Ask your PDF",
  description: "Upload a PDF and ask questions. Answers cite the page they came from.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
