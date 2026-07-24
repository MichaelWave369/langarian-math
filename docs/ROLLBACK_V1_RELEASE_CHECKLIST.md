# Governed Rollback v1.0 Release Checklist

- [ ] Merge observation and rollback anchor are content-addressed and linked.
- [ ] Live manifest hash equals the anchor merged-manifest hash.
- [ ] Restore manifest is read from the anchor application base commit.
- [ ] Incident commander signature, role, scope, narrative, and evidence references verify.
- [ ] Containment authority signature, role, scope, controls, and separation verify.
- [ ] Rollback mandates and quorum verify under the original authority decision.
- [ ] Release custodian is independent and signs an authorized rollback archive.
- [ ] Rollback target preserves immutable theory content and uses a new version.
- [ ] Materialization workflow opens a record PR only.
- [ ] Controlled writer independently revalidates the archive and replay state.
- [ ] Rollback application PR is reviewed and merged separately.
- [ ] Reconciliation emits a new MERGED observation and fresh rollback anchor.
- [ ] Promotion, incident, rollback, application, and merge records remain append-only.
