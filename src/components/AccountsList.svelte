<script>
    export let accounts;
    export let editAccount;
    export let deleteAccount;
    let newAmount;
    let showModal = false;
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
                {#if showModal}
                    <input type="number" bind:value={newAmount} placeholder="input amount" />
                    <button on:click={() => editAccount(account[0], newAmount)}>confirm</button>
                    <button on:click={() => deleteAccount(account[0])}>Delete</button>
                    <button on:click={() => showModal = false}>Cancel</button>
                {:else}
                    <button on:click={() => showModal = true}>Edit</button>
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
    }

    .table-header {
        display: table-row;
        font-weight: bold;
    }

    .table-cell {
        display: table-cell;
        padding: 10px;
        border: 1px solid #000;
    }

    .table-row {
        display: table-row;
    }
</style>