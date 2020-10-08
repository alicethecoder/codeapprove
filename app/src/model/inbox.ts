// TODO: Handle closed but not merged
export type Status = "approved" | "pending" | "merged";

export interface InboxItemData {
  owner: string;
  repo: string;
  number: string;
  title: string;
  status: Status;
  updated: number;
}

export function itemSlug(item: InboxItemData) {
  return `${item.owner}/${item.repo}#${item.number}`;
}
