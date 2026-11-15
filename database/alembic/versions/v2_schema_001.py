"""V2 schema: RBAC permissions, refresh tokens, notification preferences/delivery logs,
patient portal link, persistent lockout, multi-level escalation, patient instructions, indexes.

Revision ID: v2_schema_001
Revises: 2bce6fb3f3bb
Create Date: 2026-11-13
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'v2_schema_001'
down_revision: Union[str, None] = '2bce6fb3f3bb'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ---- users: persistent lockout + patient portal link ----
    with op.batch_alter_table('users', schema=None) as batch_op:
        batch_op.add_column(sa.Column('failed_login_count', sa.Integer(), nullable=False, server_default='0'))
        batch_op.add_column(sa.Column('locked_until', sa.DateTime(timezone=True), nullable=True))
        batch_op.add_column(sa.Column('patient_id', sa.Integer(), nullable=True))
        batch_op.create_foreign_key('fk_users_patient_id', 'patients', ['patient_id'], ['id'])
        batch_op.create_index(batch_op.f('ix_users_patient_id'), ['patient_id'], unique=False)

    # ---- escalation_rules: multi-level L1/L2/L3 ----
    with op.batch_alter_table('escalation_rules', schema=None) as batch_op:
        batch_op.add_column(sa.Column('level', sa.Integer(), nullable=False, server_default='1'))

    # ---- escalation_logs: add level + replace unique constraint with (case, rule, level, day) ----
    with op.batch_alter_table('escalation_logs', schema=None) as batch_op:
        batch_op.add_column(sa.Column('level', sa.Integer(), nullable=False, server_default='1'))
        batch_op.drop_constraint('uq_escalation_case_rule_day', type_='unique')
        batch_op.create_unique_constraint(
            'uq_escalation_case_rule_level_day',
            ['case_id', 'rule_id', 'level', 'trigger_date'],
        )

    # ---- refresh_tokens (rotating, hashed, family-reuse detection) ----
    op.create_table('refresh_tokens',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('token_hash', sa.String(length=64), nullable=False),
        sa.Column('family_id', sa.String(length=64), nullable=False),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('revoked_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('replaced_by', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['replaced_by'], ['refresh_tokens.id'], ),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('token_hash'),
    )
    with op.batch_alter_table('refresh_tokens', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_refresh_tokens_id'), ['id'], unique=False)
        batch_op.create_index(batch_op.f('ix_refresh_tokens_user_id'), ['user_id'], unique=False)
        batch_op.create_index(batch_op.f('ix_refresh_tokens_token_hash'), ['token_hash'], unique=True)
        batch_op.create_index(batch_op.f('ix_refresh_tokens_family_id'), ['family_id'], unique=False)
        batch_op.create_index(batch_op.f('ix_refresh_tokens_created_at'), ['created_at'], unique=False)

    # ---- notification_preferences (per-user channel toggles) ----
    op.create_table('notification_preferences',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('channel_enabled', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id'),
    )
    with op.batch_alter_table('notification_preferences', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_notification_preferences_id'), ['id'], unique=False)
        batch_op.create_index(batch_op.f('ix_notification_preferences_user_id'), ['user_id'], unique=True)

    # ---- delivery_logs (per-notification delivery attempt audit; never fake SENT) ----
    op.create_table('delivery_logs',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('notification_id', sa.Integer(), nullable=False),
        sa.Column('provider', sa.String(length=50), nullable=False),
        sa.Column('status', sa.String(length=20), nullable=False),
        sa.Column('detail', sa.Text(), nullable=True),
        sa.Column('attempts', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['notification_id'], ['notifications.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    with op.batch_alter_table('delivery_logs', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_delivery_logs_id'), ['id'], unique=False)
        batch_op.create_index(batch_op.f('ix_delivery_logs_notification_id'), ['notification_id'], unique=False)
        batch_op.create_index(batch_op.f('ix_delivery_logs_created_at'), ['created_at'], unique=False)

    # ---- patient_instructions (staff-entered, patient-facing; read-only in portal) ----
    op.create_table('patient_instructions',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('patient_id', sa.Integer(), nullable=False),
        sa.Column('instruction', sa.Text(), nullable=False),
        sa.Column('entered_by', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['entered_by'], ['users.id'], ),
        sa.ForeignKeyConstraint(['patient_id'], ['patients.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    with op.batch_alter_table('patient_instructions', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_patient_instructions_id'), ['id'], unique=False)
        batch_op.create_index(batch_op.f('ix_patient_instructions_patient_id'), ['patient_id'], unique=False)
        batch_op.create_index(batch_op.f('ix_patient_instructions_entered_by'), ['entered_by'], unique=False)

    # ---- Indexes on hot query paths (V2 Phase 10) ----
    with op.batch_alter_table('follow_up_cases', schema=None) as batch_op:
        batch_op.create_index('ix_cases_status_due_date', ['status', 'due_date'], unique=False)
    with op.batch_alter_table('notifications', schema=None) as batch_op:
        batch_op.create_index('ix_notifications_audience_staff', ['audience', 'staff_user_id'], unique=False)


def downgrade() -> None:
    with op.batch_alter_table('notifications', schema=None) as batch_op:
        batch_op.drop_index('ix_notifications_audience_staff')
    with op.batch_alter_table('follow_up_cases', schema=None) as batch_op:
        batch_op.drop_index('ix_cases_status_due_date')

    op.drop_table('patient_instructions')
    op.drop_table('delivery_logs')
    op.drop_table('notification_preferences')
    op.drop_table('refresh_tokens')

    with op.batch_alter_table('escalation_logs', schema=None) as batch_op:
        batch_op.drop_constraint('uq_escalation_case_rule_level_day', type_='unique')
        batch_op.create_unique_constraint('uq_escalation_case_rule_day', ['case_id', 'rule_id', 'trigger_date'])
        batch_op.drop_column('level')

    with op.batch_alter_table('escalation_rules', schema=None) as batch_op:
        batch_op.drop_column('level')

    with op.batch_alter_table('users', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_users_patient_id'))
        batch_op.drop_constraint('fk_users_patient_id', type_='foreignkey')
        batch_op.drop_column('patient_id')
        batch_op.drop_column('locked_until')
        batch_op.drop_column('failed_login_count')
