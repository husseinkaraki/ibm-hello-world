export default function Home() {
  return (
    <main>
      <p className="label">IBM Cloud · Hackathon</p>
      <h1>Hello World!</h1>
      <p>Your Next.js application is running on IBM Cloud Code Engine.</p>
      <p className="details">Built with TypeScript and React.</p>
      <a href="/health">Check application health <span aria-hidden="true">→</span></a>
    </main>
  );
}
