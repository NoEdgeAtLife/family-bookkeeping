<script>
    export let accounts;
    export let editAccount;
    export let deleteAccount;
    let newAmount;
    let newAccountName;
    let editingAccount = null;
    const startEdit = (account) => {
        editingAccount = account[0];
        newAccountName = account[0];
        newAmount = account[1];
    };
    const cancelEdit = () => {
        editingAccount = null;
        newAccountName = "";
        newAmount = "";
    };
</script>

<div class="table">
    <div class="table-header">
        <div class="table-cell">Account Name</div>
        <div class="table-cell">Amount</div>
        <div class="table-cell">Actions</div>
    </div>
    {#each accounts as account}
        <div class="table-row">
            <div class="table-cell">{account[0]}</div>
            <div class="table-cell">{account[1]}</div>
            <div class="table-cell">
                {#if editingAccount === account[0]}
                    <div class="edit-row">
                        <input type="text" bind:value={newAccountName} placeholder="Account name" />
                        <input type="number" bind:value={newAmount} placeholder="Amount" />
                    </div>
                    <div class="action-row">
                        <button class="primary" on:click={() => editAccount(account[0], newAccountName, newAmount)}>Save</button>
                        <button class="danger" on:click={() => deleteAccount(account[0])}>Delete</button>
                        <button class="ghost" on:click={cancelEdit}>Cancel</button>
                    </div>
                {:else}
                    <button class="primary" on:click={() => startEdit(account)}>Edit</button>
                {/if}
            </div>
        </div>
    {/each}
</div>

<style>
    .table {
        display: table;
        width: 100%;
        border-collapse: collapse;
        overflow-x: auto;
    }

    .table-header {
        display: table-row;
        font-weight: bold;
    }

    .table-cell {
        display: table-cell;
        padding: 10px;
        border: 1px solid #000;
        vertical-align: middle;
    }

    .table-row {
        display: table-row;
    }
    .edit-row {
        display: flex;
        gap: 8px;
        margin-bottom: 8px;
        flex-wrap: wrap;
    }
    .edit-row input {
        flex: 1;
        min-width: 120px;
        padding: 8px;
        min-height: 44px;
    }
    .action-row {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
    }
    button {
        padding: 8px 16px;
        border: none;
        background-color: #007bff;
        color: #fff;
        cursor: pointer;
        min-height: 44px;
        border-radius: 4px;
    }
    button:disabled {
        cursor: not-allowed;
        opacity: 0.6;
    }
    button.primary {
        background-color: #007bff;
    }
    button.danger {
        background-color: #d92d20;
    }
    button.ghost {
        background-color: #6c757d;
    }
    
    @media (max-width: 768px) {
        .table {
            display: block;
        }
        .table-header {
            display: none;
        }
        .table-row {
            display: block;
            margin-bottom: 15px;
            border: 1px solid #000;
            border-radius: 4px;
            padding: 10px;
        }
        .table-cell {
            display: block;
            border: none;
            padding: 8px 0;
            text-align: left;
        }
        .table-cell:before {
            content: attr(data-label);
            font-weight: bold;
            display: inline-block;
            margin-right: 10px;
        }
        .table-cell:first-child:before {
            content: "Account: ";
        }
        .table-cell:nth-child(2):before {
            content: "Amount: ";
        }
        .table-cell:nth-child(3):before {
            content: "";
        }
        .edit-row {
            flex-direction: column;
        }
        .edit-row input {
            width: 100%;
        }
        .action-row {
            flex-direction: column;
        }
        .action-row button {
            width: 100%;
        }
    }
</style>