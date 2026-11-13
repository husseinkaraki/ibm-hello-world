import Product from "./product/product";
import { episode } from "../lib/drama-episode";

export default function Home() {
  return <Product episode={episode} />;
}
