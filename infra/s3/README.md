# S3 bucket policy for private user media (example)

`user-media-bucket-policy.example.json` is a starting point for Ek B-1 of the
2026-11 audit, for a bucket that holds both the public exercise artwork and
members' media. It grants anonymous read on `exercises/*` only, and read on
the user-media prefixes only to the IAM user ImageKit uses as its origin.

Replace the placeholders, keep "Block public access" settings compatible with
the one public statement (or move user media to a separate, fully private
bucket and drop the first statement), and verify with the steps in
`docs/operations/RUNBOOKS.md`, "Media access hardening". Nothing in this
repository applies it.
