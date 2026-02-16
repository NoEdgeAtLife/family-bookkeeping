<script>
    export let accounts;
    export let editAccount;
    export let deleteAccount;
    const fmt = (v) => {
        const n = Number(v);
        return Number.isFinite(n) ? n.toFixed(2) : v;
    };
    let newAmount;
    let newAccountName;
    let editingAccount = null;
    let showEditModal = false;
    let editSubmitting = false;
    let editStatus = "";
    let editError = "";
    let lastEditPayload = null;

    const startEdit = (account) => {
        editingAccount = account[0];
        newAccountName = account[0];
        newAmount = account[1];
        showEditModal = true;
    };
    const cancelEdit = () => {
        editingAccount = null;
        newAccountName = "";
        newAmount = "";
        showEditModal = false;
        editError = "";
        editStatus = "";
    };

    const handleSaveAccount = async () => {
        const payload = { name: newAccountName, amount: newAmount };
        lastEditPayload = { original: editingAccount, payload };
        editSubmitting = true;
        editStatus = "Saving account...";
        editError = "";
        try {
            await editAccount(editingAccount, newAccountName, newAmount);
            editStatus = "Account updated";
            editingAccount = null;
            newAccountName = "";
            newAmount = "";
            showEditModal = false;
            setTimeout(() => (editStatus = ""), 1500);
        } catch (err) {
            console.error(err);
            editError = "Failed to update account. Please retry.";
        } finally {
            editSubmitting = false;
        }
    };

    const handleDeleteAccount = async () => {
        if (!editingAccount) return;
        editSubmitting = true;
        editStatus = "Deleting account...";
        editError = "";
        try {
            await deleteAccount(editingAccount);
            editStatus = "Account deleted";
            editingAccount = null;
            newAccountName = "";
            newAmount = "";
            showEditModal = false;
            setTimeout(() => (editStatus = ""), 1500);
        } catch (err) {
            console.error(err);
            editError = "Failed to delete account. Please retry.";
        } finally {
            editSubmitting = false;
        }
    };

    const retryEdit = async () => {
        if (!lastEditPayload) return;
        editSubmitting = true;
        editStatus = "Retrying...";
        editError = "";
        try {
            await editAccount(lastEditPayload.original, lastEditPayload.payload.name, lastEditPayload.payload.amount);
            editStatus = "Account updated";
            editingAccount = null;
            newAccountName = "";
            newAmount = "";
            showEditModal = false;
        } catch (err) {
            console.error(err);
            editError = "Retry failed. Please try again.";
        } finally {
            editSubmitting = false;
        }
    };

    const dismissEditStatus = () => {
        editStatus = "";
        editError = "";
    };
</script>

<div class="table-wrapper">
    <div class="table">
        <div class="table-header">
            <div class="table-cell">Account</div>
            <div class="table-cell">$</div>
              <div class="table-cell actions-cell" aria-hidden="true"></div>
        </div>
        {#each accounts as account}
            <div class="table-row">
                <div class="table-cell">{account[0]}</div>
                <div class="table-cell">{fmt(account[1])}</div>
                <div class="table-cell">
                    <button class="icon edit" on:click={() => startEdit(account)} aria-label="Edit">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25z" fill="currentColor" />
                            <path d="M20.71 7.04a1.003 1.003 0 0 0 0-1.41l-2.34-2.34a1.003 1.003 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" fill="currentColor" />
                        </svg>
                    </button>
                </div>
            </div>
        {/each}
        {#if showEditModal}
            <div class="modal-overlay">
                <div class="modal-backdrop" role="button" aria-label="Close edit modal" tabindex="0" on:click={cancelEdit} on:keydown={(e) => (e.key === 'Enter' || e.key === ' ') && cancelEdit()}></div>
                <!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
                <div class="modal" role="dialog" aria-modal="true" on:click|stopPropagation tabindex="-1" on:keydown={(e) => e.key === 'Escape' && cancelEdit()}>
                    <h3>Edit Account</h3>
                    <div class="modal-row">
                        <label for="edit-account-name">Account name</label>
                        <input id="edit-account-name" class="compact-input" type="text" bind:value={newAccountName} />
                    </div>
                    <div class="modal-row">
                        <label for="edit-account-amount">$</label>
                        <input id="edit-account-amount" class="compact-input" type="number" bind:value={newAmount} />
                    </div>
                    <div class="modal-actions">
                        <button class="primary" on:click={handleSaveAccount} disabled={editSubmitting}>Save</button>
                        <button class="danger" on:click={handleDeleteAccount} disabled={editSubmitting}>Delete</button>
                        <button class="ghost" on:click={cancelEdit}>Cancel</button>
                    </div>
                    {#if editStatus || editError}
                        <div class="txStatus" aria-live="polite">
                            {#if editStatus}
                                <span class="success">{editStatus}</span>
                            {/if}
                            {#if editError}
                                <span class="error">{editError}</span>
                                <button class="retry" on:click={retryEdit} disabled={editSubmitting}>Retry</button>
                            {/if}
                            <button class="dismiss" on:click={dismissEditStatus} aria-label="Dismiss">✕</button>
                        </div>
                    {/if}
                </div>
            </div>
        {/if}
    </div>
</div>

<style>
    .table-wrapper {
        width: 100%;
        overflow-x: auto;
        -webkit-overflow-scrolling: touch;
    }

    .table {
        display: table;
        width: 100%;
        border-collapse: collapse;
        min-width: 800px;
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
        white-space: nowrap;
    }

    .table-row {
        display: table-row;
    }
    button {
        padding: 6px 12px;
        border: none;
        background-color: #007bff;
        color: #fff;
        cursor: pointer;
        min-height: 36px;
        border-radius: 6px;
        white-space: nowrap;
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
    
        /* Modal styles (mirrors TransactionsList modal) */
        .modal-overlay {
            position: fixed;
            inset: 0;
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 1000;
            padding: 16px;
        }
        .modal-backdrop {
            position: absolute;
            inset: 0;
            background: rgba(16,24,40,0.06);
            border: none;
            padding: 0;
            z-index: 1000;
        }
        .modal {
            background: #fff;
            padding: 16px;
            border-radius: 8px;
            width: 100%;
            max-width: 520px;
            box-shadow: 0 6px 18px rgba(0,0,0,0.2);
            position: relative;
            z-index: 1001;
        }
        .modal h3 {
            margin: 0 0 8px 0;
        }
        .modal-row {
            display: flex;
            flex-direction: column;
            gap: 6px;
            margin-bottom: 8px;
        }
        .modal-row label {
            font-size: 0.85rem;
        }
        .modal-row input,
        .modal-actions {
            display: flex;
            gap: 8px;
            justify-content: flex-end;
            margin-top: 8px;
        }
        button.icon {
            background: transparent;
            padding: 6px;
            min-height: auto;
            width: 40px;
            height: 40px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            border-radius: 6px;
        }
        button.icon:hover { background: rgba(0,0,0,0.05); }
    
    @media (max-width: 768px) {
        .table {
            font-size: 0.5rem;
            min-width: 80px;
        }
        .table-cell {
            padding: 4px 6px;
        }
        button {
            padding: 4px 8px;
            font-size: 0.75rem;
        }
        input[type="text"] {
            max-width: 100%;
            font-size: 0.5rem;
        }
    }
</style>