import { HomeClient } from "./home-client";
import type { DrawResult } from "./site-data";
import results from "../public/data/results.json";

export default function Home() {
  return <HomeClient initialResults={(results as DrawResult[]).slice(0, 30)} />;
}
