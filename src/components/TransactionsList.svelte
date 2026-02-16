<script>
  export let txs;
  export let accounts = [];
  export let deleteTransaction;
  export let editTransaction;
  let editingTxIndex = null;
  let editAmount;
  let editDate;
  let editDescription;
  let editFrom;
  let editTo;
  let itemsPerPage = 10;
  let searchQuery = "";
  $: orderedTxs = (txs || []).slice();
  $: filteredTxs = searchQuery.trim() 
    ? orderedTxs.filter(tx => String(tx[1].description || tx.descriptions || "").toLowerCase().includes(searchQuery.trim().toLowerCase()))
    : orderedTxs;
  $: console.log("Debug: searchQuery =", searchQuery, ", filteredTxs count =", filteredTxs.length);
  $: console.log("Debug: searchQuery:", searchQuery, "filteredTxs:", filteredTxs);
  function debugFilter() {
      console.log("Debug Filter:");
      console.log("searchQuery:", searchQuery);
    console.log("orderedTxs count:", orderedTxs.length);
      console.log("filteredTxs count:", filteredTxs.length);
  }
  let currentPage = 1;
  $: maxPage = Math.ceil(filteredTxs.length / itemsPerPage);
  $: if (currentPage > maxPage) currentPage = 1;
  $: nextPage = () => currentPage < maxPage && currentPage++;
  $: previousPage = () => currentPage > 1 && currentPage--;
  $: goToPage = (page) => currentPage = page;
  $: paginatedTxs = filteredTxs.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  let exportTx = () => {
    const data = JSON.stringify(txs);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "transactions.json";
    a.click();
    URL.revokeObjectURL(url);
  };
  const startEdit = (index, tx) => {
    editingTxIndex = index;
    editingTx = tx;
    editAmount = tx.amount;
    editDate = tx.date;
    editDescription = tx.description;
    editFrom = tx.from;
    editTo = tx.to;
    showEditModal = true;
  };
  const cancelEdit = () => {
    editingTxIndex = null;
    editingTx = null;
    editAmount = "";
    editDate = "";
    editDescription = "";
    editFrom = "";
    editTo = "";
    showEditModal = false;
    deleteConfirm = false;
  };
  // Edit status state and helpers
  let editSubmitting = false;
  let editStatus = "";
  let editError = "";
  let lastEditPayload = null;
  const dismissEditStatus = () => {
    editStatus = "";
    editError = "";
  };
  let showEditModal = false;
  let editingTx = null;

  // Delete status state and helpers
  let deleteSubmitting = false;
  let deleteStatus = "";
  let deleteError = "";
  let lastDeletePayload = null;
  let deleteConfirm = false;
  const dismissDeleteStatus = () => {
    deleteStatus = "";
    deleteError = "";
  };

  const handleSave = async (index) => {
    const payload = { amount: editAmount, date: editDate, description: editDescription, from: editFrom, to: editTo };
    lastEditPayload = { index, payload };
    editSubmitting = true;
    editStatus = "Saving transaction...";
    editError = "";
    try {
      await editTransaction(index, payload);
      editStatus = "Transaction updated";
      // auto-collapse and clear edit fields and close modal
      editingTxIndex = null;
      editingTx = null;
      editAmount = "";
      editDate = "";
      editDescription = "";
      editFrom = "";
      editTo = "";
      showEditModal = false;
    } catch (err) {
      console.error(err);
      editError = "Failed to update transaction. Please retry.";
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
      await editTransaction(lastEditPayload.index, lastEditPayload.payload);
      editStatus = "Transaction updated";
      editingTxIndex = null;
      editAmount = "";
      editDate = "";
      editDescription = "";
      editFrom = "";
      editTo = "";
    } catch (err) {
      console.error(err);
      editError = "Retry failed. Please try again.";
    } finally {
      editSubmitting = false;
    }
  };

  const handleDelete = async (index, tx) => {
    lastDeletePayload = { index, tx };
    deleteSubmitting = true;
    deleteStatus = "Deleting transaction...";
    deleteError = "";
    try {
      await deleteTransaction(index, tx);
      deleteStatus = "Transaction deleted";
      // collapse edit and close modal if open
      editingTxIndex = null;
      editingTx = null;
      showEditModal = false;
      deleteConfirm = false;
      // auto-clear success message after a short delay
      setTimeout(() => (deleteStatus = ""), 2000);
    } catch (err) {
      console.error(err);
      deleteError = "Failed to delete transaction. Please retry.";
    } finally {
      deleteSubmitting = false;
    }
  };

  const retryDelete = async () => {
    if (!lastDeletePayload) return;
    deleteSubmitting = true;
    deleteStatus = "Retrying delete...";
    deleteError = "";
    try {
      await deleteTransaction(lastDeletePayload.index, lastDeletePayload.tx);
      deleteStatus = "Transaction deleted";
      editingTxIndex = null;
      editingTx = null;
      showEditModal = false;
      deleteConfirm = false;
      setTimeout(() => (deleteStatus = ""), 2000);
    } catch (err) {
      console.error(err);
      deleteError = "Retry failed. Please try again.";
    } finally {
      deleteSubmitting = false;
    }
  };
  </script>
  <div class="searchRow">
    <input class="compact-input" type="text" placeholder="Search transactions by description" bind:value={searchQuery} on:input={() => currentPage = 1} />
    <button class="icon export" on:click={exportTx} aria-label="Export transactions">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 3v10" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M5 10l7-7 7 7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M21 21H3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </button>
  </div>
  <div class="table-wrapper">
    <div class="table">
      <div class="table-header">
        <div class="table-cell">Date</div>
        <div class="table-cell">From</div>
        <div class="table-cell">To</div>
        <div class="table-cell">$</div>
        <div class="table-cell">Descriptions</div>
        <div class="table-cell actions-cell" aria-hidden="true"></div>
      </div>
      {#each paginatedTxs as [index, tx]}
        <div class="table-row">
          <div class="table-cell">{tx.date}</div>
          <div class="table-cell">{tx.from}</div>
          <div class="table-cell">{tx.to}</div>
          <div class="table-cell">{tx.amount}</div>
          <div class="table-cell">{tx.description}</div>
          <div class="table-cell">
            <div class="action-row">
              <button class="icon edit" on:click={() => startEdit(index, tx)} aria-label="Edit">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25z" fill="currentColor" />
                  <path d="M20.71 7.04a1.003 1.003 0 0 0 0-1.41l-2.34-2.34a1.003 1.003 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" fill="currentColor" />
                </svg>
              </button>
            </div>
          </div>
            {#if showEditModal}
              <div class="modal-overlay">
                <button class="modal-backdrop" type="button" aria-label="Close edit modal" on:click={cancelEdit}></button>
                <!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
                <div class="modal" role="dialog" aria-modal="true" on:click|stopPropagation tabindex="-1" on:keydown={(e) => e.key === 'Escape' && cancelEdit()}>
                  <h3>Edit Transaction</h3>
                  <div class="modal-row">
                    <label for={"edit-date-" + editingTxIndex}>Date</label>
                    <input class="compact-input" id={"edit-date-" + editingTxIndex} type="date" bind:value={editDate} />
                  </div>
                  <div class="modal-row">
                    <label for={"edit-from-" + editingTxIndex}>From</label>
                    <select class="compact-select" id={"edit-from-" + editingTxIndex} bind:value={editFrom}>
                      <option value="">Select account</option>
                      {#each accounts as [accountName]}
                        <option value={accountName}>{accountName}</option>
                      {/each}
                    </select>
                  </div>
                  <div class="modal-row">
                    <label for={"edit-to-" + editingTxIndex}>To</label>
                    <select class="compact-select" id={"edit-to-" + editingTxIndex} bind:value={editTo}>
                      <option value="">Select account</option>
                      {#each accounts as [accountName]}
                        <option value={accountName}>{accountName}</option>
                      {/each}
                    </select>
                  </div>
                  <div class="modal-row">
                    <label for={"edit-amount-" + editingTxIndex}>$</label>
                    <input class="compact-input" id={"edit-amount-" + editingTxIndex} type="number" bind:value={editAmount} />
                  </div>
                  <div class="modal-row">
                    <label for={"edit-desc-" + editingTxIndex}>Description</label>
                    <input class="compact-input" id={"edit-desc-" + editingTxIndex} type="text" bind:value={editDescription} />
                  </div>
                  <div class="modal-actions">
                              <button class="primary" on:click={() => handleSave(editingTxIndex)} disabled={editSubmitting}>Save</button>
                              {#if !deleteConfirm}
                                <button class="danger" on:click={() => (deleteConfirm = true)} disabled={deleteSubmitting}>Delete</button>
                              {:else}
                                <span>Confirm delete?</span>
                                <button class="danger" on:click={() => handleDelete(editingTxIndex, editingTx)} disabled={deleteSubmitting}>Yes, delete</button>
                                <button class="ghost" on:click={() => (deleteConfirm = false)}>Cancel</button>
                              {/if}
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
                        <button class="dismiss" on:click={dismissEditStatus} aria-label="Dismiss">✕</button>
                      {/if}
                    </div>
                  {/if}
                </div>
              </div>
            {/if}
        </div>
      {/each}
    </div>
  </div>

  <div class="pagination">
    <button on:click={previousPage} disabled={currentPage === 1}>Previous</button>
    {#each Array.from({ length: Math.ceil(filteredTxs.length / itemsPerPage) }) as _, i}
      {#if i === 0 || (i >= currentPage - 1 && i <= currentPage + 1) || i === maxPage - 1}
      <button on:click={() => goToPage(i + 1)} class:selected={currentPage === i + 1}>{i + 1}</button>
      {/if}
      {#if i === currentPage + 2 && i !== maxPage - 1}
      <span>...</span>
      {/if}
      {#if i === 0 && currentPage > 3}
      <span>...</span>
      {/if}
    {/each}
    <button on:click={nextPage} disabled={currentPage === Math.ceil(filteredTxs.length / itemsPerPage)}>Next</button>
  </div>

  <style>
    button {
      padding: 6px 12px;
      border: none;
      background-color: #007bff;
      color: #fff;
      cursor: pointer;
      border-radius: 6px;
      min-height: 36px;
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

    .selected {
      font-weight: bold;
      background-color: #007bff;
      color: #fff;
    }

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

    .action-row {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }

    .pagination {
      display: flex;
      justify-content: center;
      align-items: center;
      margin-top: 10px;
      flex-wrap: wrap;
      gap: 5px;
    }

    .pagination button {
      margin: 0;
    }

    .pagination span {
      padding: 8px;
    }

    input[type="text"] {
      padding: 6px 8px;
      border: 1px solid #e6e9ee;
      border-radius: 6px;
      min-height: 36px;
      width: 100%;
      max-width: 480px;
      margin-bottom: 10px;
      box-shadow: inset 0 1px 2px rgba(16,24,40,0.03);
    }

    .compact-input {
      padding: 6px 8px;
      border: 1px solid #e6e9ee;
      border-radius: 6px;
      min-height: 36px;
      font-size: 0.95rem;
      box-shadow: inset 0 1px 2px rgba(16,24,40,0.03);
      width: 100%;
    }

    .compact-select {
      padding: 6px 8px;
      border: 1px solid #e6e9ee;
      border-radius: 6px;
      min-height: 36px;
      font-size: 0.95rem;
      background: #fff;
    }

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
      /* inline edit responsive styles removed */
      .action-row {
        gap: 4px;
      }
      .pagination button {
        padding: 6px 10px;
        font-size: 0.75rem;
      }
      .pagination span {
        padding: 4px;
      }
      input[type="text"] {
        max-width: 100%;
        /* padding: 6px; */
        font-size: 0.5rem;
      }
    }

    /* Modal styles */
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
    }
    .modal {
      background: #fff;
      padding: 16px;
      border-radius: 8px;
      width: 100%;
      max-width: 520px;
      box-shadow: 0 6px 18px rgba(0,0,0,0.2);
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
    .modal-row select {
      padding: 6px 8px;
      min-height: 36px;
      border-radius: 6px;
      border: 1px solid #e6e9ee;
      box-shadow: inset 0 1px 2px rgba(16,24,40,0.03);
    }
    .modal-actions {
      display: flex;
      gap: 8px;
      justify-content: flex-end;
      margin-top: 8px;
    }
    button.icon {
      background: transparent;
      padding: 4px;
      min-height: auto;
      width: 32px;
      height: 32px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border-radius: 6px;
    }
    button.icon:hover { background: rgba(0,0,0,0.04); }
    .searchRow {
      display: flex;
      gap: 8px;
      align-items: center;
      margin-bottom: 10px;
      width: 100%;
    }
    .searchRow .compact-input {
      flex: 1 1 auto;
      margin-bottom: 0;
    }
    .searchRow .icon.export {
      background: #007bff;
      color: #fff;
      width: 40px;
      height: 40px;
      padding: 6px;
      border-radius: 8px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border: none;
    }
  </style>
