"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isCoverUpToDate = isCoverUpToDate;
function isCoverUpToDate(record) {
    const cover = record.get('cover');
    // check if record already has cover uploaded
    if (cover && cover.length > 0)
        return true;
    // if cover is not uploaded, check if reviews are unanimously great
    const kevReview = record.get('kev review');
    const netReview = record.get('net review');
    // if not good enough, we should consider the cover up to date so that we don't update it. otherwise, we say it's outdated so we can update it
    return !(kevReview == netReview && kevReview == '🥰') ? true : false;
}
