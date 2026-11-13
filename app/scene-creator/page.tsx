import type { Metadata } from "next";
import { episodes } from "../../lib/drama-episode";
import SceneCreator from "./scene-creator";

export const metadata: Metadata = {
  title: "Scene Creator",
  description: "Choose a Finding Love at a Hackathon scene, direct your take, and create a personalized video with Veo 3.1 Fast.",
};

export default function SceneCreatorPage() {
  return <SceneCreator episodes={episodes} />;
}
