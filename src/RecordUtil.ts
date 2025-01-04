import { Attachment, FieldSet, Record } from "airtable";

export function isCoverUpToDate(record: Record<FieldSet>): boolean {
  const cover = record.get("cover") as Attachment[] | undefined;

  // check if record already has cover uploaded
  if (cover && cover.length > 0) return true;

  // if cover is not uploaded, check if reviews are unanimously great
  const kevReview = record.get("kev review") as string;
  const netReview = record.get("net review") as string;
  // if not good enough, we should consider the cover up to date so that we don't update it. otherwise, we say it's outdated so we can update it
  return !(kevReview == netReview && kevReview == "🥰") ? true : false;
}
