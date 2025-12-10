export default `# BTMS Topic Manager

Validates and admits BTMS (Basic Token Management System) PushDrop token outputs.

## Token Structure
BTMS tokens are PushDrop scripts with 4 fields:
- **Field 0**: assetId (string) - The token identifier
- **Field 1**: amount (string) - Numeric amount of tokens
- **Field 2**: op (string) - Operation type: "ISSUE" or "TRANSFER"
- **Field 3**: metadata (JSON string) - Token metadata

## Validation Rules
Only outputs that meet ALL of the following criteria are admitted:
1. Valid PushDrop script with at least 4 fields
2. Non-empty assetId
3. Positive numeric amount
4. Valid operation type (ISSUE or TRANSFER)
5. Valid JSON metadata

## Usage
Use the corresponding BTMS Lookup Service (service: "ls_btms") to query admitted outputs.`
