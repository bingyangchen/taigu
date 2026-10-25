from django.contrib.postgres.operations import AddIndexConcurrently
from django.db.backends.base.schema import BaseDatabaseSchemaEditor
from django.db.migrations.state import ProjectState


class RerunnableAddIndexConcurrently(AddIndexConcurrently):
    """
    A concurrent index build that fails leaves an invalid index behind, which makes
    rerunning the migration fail with "already exists". This drops any such index
    before building it.
    """

    def database_forwards(
        self,
        app_label: str,
        schema_editor: BaseDatabaseSchemaEditor,
        from_state: ProjectState,
        to_state: ProjectState,
    ) -> None:
        schema_editor.execute(
            "DROP INDEX CONCURRENTLY IF EXISTS "
            f"{schema_editor.quote_name(self.index.name)}"
        )
        super().database_forwards(app_label, schema_editor, from_state, to_state)
