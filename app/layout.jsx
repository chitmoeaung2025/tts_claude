import './globals.css';

export const metadata = {
  title: 'TTS Studio — AI84pro',
  description: 'Professional Text-to-Speech Studio powered by AI84pro',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
