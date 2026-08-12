import { HomeClient } from "./home-client";
import { results } from "./site-data";

export default function Home() {
  return <HomeClient initialResults={results} />;
}
