import { Review } from "../../../shared/types";

export function itemSlug(item: Review) {
  return `${item.metadata.owner}/${item.metadata.repo}#${item.metadata.number}`;
}
