<script>
  export let txs;
  export let deleteTransaction;
  let showModal = false;
  let newAmount;
</script>

<div class="table">
  <div class="table-header">
    <div class="table-cell">Date</div>
    <div class="table-cell">From Account</div>
    <div class="table-cell">To Account</div>
    <div class="table-cell">Amount</div>
    <div class="table-cell">Descriptions</div>
    <div class="table-cell">Actions</div>
  </div>
  {#each txs as [index, tx]}
    <div class="table-row">
      <div class="table-cell">{tx.date}</div>
            <div class="table-cell">{tx.from}</div>
            <div class="table-cell">{tx.to}</div>
            <div class="table-cell">{tx.amount}</div>
            <div class="table-cell">{tx.description}</div>
            <div class="table-cell">
                {#if showModal}
                    <input type="number" bind:value={newAmount} placeholder="input amount" />
                    <button on:click={() => deleteTransaction(index)}>Delete</button>
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