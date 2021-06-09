import ActorSheetT20NPC from "../../systems/tormenta20/module/actor/sheet/npc.js";
import ItemT20 from "../../systems/tormenta20/module/item/entity.js";

class LootSheet5eNPCHelper {
		/**
		 * Retrieve the loot permission for a player, given the current actor data.
		 * 
		 * It first tries to get an entry from the actor's permissions, if none is found it uses default, otherwise returns 0.
		 * 
		 */
		static getLootPermissionForPlayer(actorData, player) {
				let defaultPermission = actorData.permission.default;
				if (player.data._id in actorData.permission) {
						return actorData.permission[player.data._id];
				}
				else if (typeof defaultPermission !== "undefined") {
						return defaultPermission;
				}
				return 0;
		}
}

class QuantityDialog extends Dialog {
	constructor(callback, options) {
		if (typeof (options) !== "object") {
			options = {};
		}

		let applyChanges = false;
		super({
			title: "Quantidade",
			content: `
			<form>
				<div class="form-group">
					<label>Quantidade:</label>
					<input type=number min="1" id="quantity" name="quantity" value="1">
				</div>
			</form>`,
			buttons: {
				yes: {
					icon: "<i class='fas fa-check'></i>",
					label: options.acceptLabel ? options.acceptLabel : "Aceitar",
					callback: () => applyChanges = true
				},
				no: {
					icon: "<i class='fas fa-times'></i>",
					label: "Cancelar"
				},
			},
			default: "yes",
			close: () => {
				if (applyChanges) {
					var quantity = document.getElementById('quantity').value

					if (isNaN(quantity)) {
						return ui.notifications.error(`Quantidade inválida.`);
					}

					callback(quantity);

				}
			}
		});
	}
}

class LootSheet5eNPC extends ActorSheetT20NPC {

	static SOCKET = "module.fichaloott20";

	get template() {
		// adding the #equals and #unequals handlebars helper
		Handlebars.registerHelper('equals', function (arg1, arg2, options) {
			return (arg1 == arg2) ? options.fn(this) : options.inverse(this);
		});

		Handlebars.registerHelper('unequals', function (arg1, arg2, options) {
			return (arg1 != arg2) ? options.fn(this) : options.inverse(this);
		});

		Handlebars.registerHelper('lootsheetprice', function (basePrice, modifier) {
			return "T$ " + (Math.round(basePrice * modifier * 100) / 100).toLocaleString('en');
		});

		Handlebars.registerHelper('lootsheetstackweight', function (weight, qty) {
				if (game.settings.get("fichaloott20", "showStackWeight")) {
						return `${(weight * qty).toLocaleString('en')}`;
				}
				return ""
		});

		Handlebars.registerHelper('lootsheetweight', function (weight) {
			return (Math.round(weight * 1e5) / 1e5).toString();
		});
		
		const path = "systems/tormenta20/templates/actor/";
		if (!game.user.isGM && this.actor.limited) return path + "actor-limited-sheet.html";
		return "modules/fichaloott20/template/npc-sheet.html";
	}

	static get defaultOptions() {
		const options = super.defaultOptions;

		mergeObject(options, {
			classes: ["tormenta20 sheet actor npc npc-sheet loot-sheet-npc"],
			width: 890,
			height: 750
		});
		return options;
	}

	async getData() {
		const sheetData = super.getData();

		// Prepare GM Settings
		this._prepareGMSettings(sheetData.actor);

		// Prepare isGM attribute in sheet Data

		if (game.user.isGM) sheetData.isGM = true;
		else sheetData.isGM = false;
		console.log(this.actor);

		let lootsheettype = await this.actor.getFlag("fichaloott20", "lootsheettype");
		if (!lootsheettype) await this.actor.setFlag("fichaloott20", "lootsheettype", "Loot");
		lootsheettype = await this.actor.getFlag("fichaloott20", "lootsheettype");


		let priceModifier = 1.0;
		if (lootsheettype === "Merchant") {
			priceModifier = await this.actor.getFlag("fichaloott20", "priceModifier");
			if (!priceModifier) await this.actor.setFlag("fichaloott20", "priceModifier", 1.0);
			priceModifier = await this.actor.getFlag("fichaloott20", "priceModifier");
		}

		let totalWeight = 0;
		this.actor.data.items.contents.forEach((item)=>totalWeight += Math.round((item.data.data.qtd * item.data.data.peso * 100) / 100));

		let totalPrice = 0;
		this.actor.data.items.contents.forEach((item)=>totalPrice += Math.round((item.data.data.qtd * item.data.data.preco * priceModifier * 100) / 100));

		let totalQuantity = 0;
		this.actor.data.items.contents.forEach((item)=>totalQuantity += Math.round((item.data.data.qtd * 100) / 100));

		sheetData.lootsheettype = lootsheettype;
		sheetData.totalItems = this.actor.data.items.contents.length;
		sheetData.totalWeight = totalWeight.toLocaleString('en');
		sheetData.totalPrice = "T$ " + totalPrice.toLocaleString('en');
		sheetData.totalQuantity = totalQuantity;
		sheetData.priceModifier = priceModifier;
		sheetData.rolltables = game.tables.entities;
		sheetData.lootCurrency = game.settings.get("fichaloott20", "lootCurrency");
		sheetData.lootAll = game.settings.get("fichaloott20", "lootAll");

		// Return data for rendering
		return sheetData;
	}

	/* -------------------------------------------- */
	/* Event Listeners and Handlers
	/* -------------------------------------------- */

	/**
	 * Activate event listeners using the prepared sheet HTML
	 * @param html {HTML} The prepared HTML object ready to be rendered into the DOM
	 */
	activateListeners(html) {
		super.activateListeners(html);
		if (this.options.editable) {
			// Toggle Permissions
			html.find('.permission-proficiency').click(ev => this._onCyclePermissionProficiency(ev));
			html.find('.permission-proficiency-bulk').click(ev => this._onCyclePermissionProficiencyBulk(ev));

			// Price Modifier
			html.find('.price-modifier').click(ev => this._priceModifier(ev));

			html.find('.merchant-settings').change(ev => this._merchantSettingChange(ev));
			html.find('.update-inventory').click(ev => this._merchantInventoryUpdate(ev));
		}

		// Split Coins
		html.find('.split-coins').removeAttr('disabled').click(ev => this._distributeCoins(ev));

		// Buy Item
		html.find('.item-buy').click(ev => this._buyItem(ev));
		html.find('.item-buyall').click(ev => this._buyItem(ev, 1));

		// Loot Item
		html.find('.item-loot').click(ev => this._lootItem(ev));
		html.find('.item-lootall').click(ev => this._lootItem(ev, 1));

		// Loot Currency
		html.find('.currency-loot').click(ev => this._lootCoins(ev));

		// Loot All
		html.find('.loot-all').removeAttr('disabled').click(ev => this._lootAll(ev, html));

		// Sheet Type
		html.find('.sheet-type').change(ev => this._changeSheetType(ev, html));

		// Roll Table
		//html.find('.sheet-type').change(ev => this._changeSheetType(ev, html));

	}

	/* -------------------------------------------- */

	/**
	 * Handle merchant settings change
	 * @private
	 */
	async _merchantSettingChange(event, html) {
		event.preventDefault();
		console.log("Ficha Loot | Merchant settings changed");

		const moduleNamespace = "fichaloott20";
		const expectedKeys = ["rolltable", "shopQty", "itemQty", "itemQtyLimit", "clearInventory", "itemOnlyOnce"];

		let targetKey = event.target.name.split('.')[3];


		if (expectedKeys.indexOf(targetKey) === -1) {
			console.log(`Ficha Loot | Error changing stettings for "${targetKey}".`);
			return ui.notifications.error(`Error changing stettings for "${targetKey}".`);
		}

		if (targetKey == "clearInventory" || targetKey == "itemOnlyOnce") {
			console.log(targetKey + " set to " + event.target.checked);
			await this.actor.setFlag(moduleNamespace, targetKey, event.target.checked);
		} else if (event.target.value) {
			console.log(targetKey + " set to " + event.target.value);
			console.log("A");
			await this.actor.setFlag(moduleNamespace, targetKey, event.target.value);
		} else {
			console.log(targetKey + " set to " + event.target.value);
			console.log("B");
			await this.actor.unsetFlag(moduleNamespace, targetKey, event.target.value);
		}
	}

	/* -------------------------------------------- */

	/**
	 * Handle merchant inventory update
	 * @private
	 */
	async _merchantInventoryUpdate(event, html) {
		event.preventDefault();

		const moduleNamespace = "fichaloott20";
		const rolltableName = this.actor.getFlag(moduleNamespace, "rolltable");
		const shopQtyFormula = this.actor.getFlag(moduleNamespace, "shopQty") || "1";
		const itemQtyFormula = this.actor.getFlag(moduleNamespace, "itemQty") || "1";
		const itemQtyLimit = this.actor.getFlag(moduleNamespace, "itemQtyLimit") || "0";
		const clearInventory = this.actor.getFlag(moduleNamespace, "clearInventory");
		const itemOnlyOnce = this.actor.getFlag(moduleNamespace, "itemOnlyOnce");
		const reducedVerbosity = game.settings.get("fichaloott20", "reduceUpdateVerbosity");

		let shopQtyRoll = new Roll(shopQtyFormula);
		shopQtyRoll.roll();

		let rolltable = game.tables.getName(rolltableName);
		if (!rolltable) {
			//console.log(`Ficha Loot | No Rollable Table found with name "${rolltableName}".`);
			return ui.notifications.error(`Não há Tabela de Rolagem com o nome "${rolltableName}".`);
		}

		if (itemOnlyOnce) {
			if (rolltable.results.length < shopQtyRoll.total)	{
				return ui.notifications.error(`Não é possível criar uma loja com ${shopQtyRoll.total} entradas únicas se a tabela de rolagem tem apenas ${rolltable.results.length} itens`);
			}
		}

		//console.log(rolltable);

		if (clearInventory) {

			let currentItems = this.actor.data.items.map(i => i._id);
			await this.actor.deleteEmbeddedDocuments("Item", currentItems);
			//console.log(currentItems);
		}

		console.log(`Ficha Loot | Adding ${shopQtyRoll.result} new items`);

		for (let i = 0; i < shopQtyRoll.total; i++) {
			const rollResult = await rolltable.roll();
			//console.log(rollResult.results[0]);
			let newItem = null;

			if (rollResult.results[0].data.collection === "Item") {
				newItem = game.items.get(rollResult.results[0].data.resultId);
			}
			else {
				//Try to find it in the compendium
				const items = game.packs.get(rollResult.results[0].data.collection);
				//console.log(items);
				//dnd5eitems.getIndex().then(index => console.log(index));
				//let newItem = dnd5eitems.index.find(e => e.id === rollResult.results[0].resultId);
				//items.getEntity(rollResult.results[0].resultId).then(i => console.log(i));
				newItem = await items.getEntity(rollResult.results[0].data.resultId);
			}
			if (!newItem || newItem === null) {
				//console.log(`Ficha Loot | No item found "${rollResult.results[0].resultId}".`);
				return ui.notifications.error(`Nenhum item encontrado "${rollResult.results[0].resultId}".`);
			}

			if (newItem.type === "spell") {
				newItem = await ItemT20.createScrollFromSpell(newItem)
			}

			let itemQtyRoll = new Roll(itemQtyFormula);
			itemQtyRoll.roll();
			// console.log(`Ficha Loot | Adding ${itemQtyRoll.total} x ${newItem.name}`)

			//newItem.data.qtd = itemQtyRoll.result;

			let existingItem = this.actor.items.find(item => item.data.name == newItem.name);

			if (existingItem === undefined) {
				await this.actor.createEmbeddedDocuments("Item", [newItem.toObject()]);
				console.log(`Ficha Loot | ${newItem.name} não existe.`);
				existingItem = this.actor.items.find(item => item.data.name == newItem.name);

				if (itemQtyLimit > 0 && Number(itemQtyLimit) < Number(itemQtyRoll.total)) {
					await existingItem.update({ "data.qtd": itemQtyLimit });
					if (!reducedVerbosity) ui.notifications.info(`Added new ${itemQtyLimit} x ${newItem.name}.`);
				} else {
					await existingItem.update({ "data.qtd": itemQtyRoll.total });
					if (!reducedVerbosity) ui.notifications.info(`Added new ${itemQtyRoll.total} x ${newItem.name}.`);
				}
			}
			else {
				console.log(`Ficha Loot | Item ${newItem.name} existe.`, existingItem);
				
				let newQty = Number(existingItem.data.data.qtd) + Number(itemQtyRoll.total);

				// if (itemQtyLimit > 0 && Number(itemQtyLimit) === Number(existingItem.data.data.qtd)) {
					// if (!reducedVerbosity) ui.notifications.info(`${newItem.name} already at maximum quantity (${itemQtyLimit}).`);
				// } else
				if (itemQtyLimit > 0 && Number(itemQtyLimit) < Number(newQty)) {
					//console.log("Exceeds existing quantity, limiting");
					await existingItem.update({ "data.qtd": itemQtyLimit });
					if (!reducedVerbosity) ui.notifications.info(`Added additional quantity to ${newItem.name} to the specified maximum of ${itemQtyLimit}.`);
				}
				else {
					await existingItem.update({ "data.qtd": newQty });
					if (!reducedVerbosity) ui.notifications.info(`Added additional ${itemQtyRoll.total} quantity to ${newItem.name}.`);
				}
			}
		}
	}

	_createRollTable() {

		let type = "weapon";

		game.packs.map(p => p.collection);

		const pack = game.packs.find(p => p.collection === "dnd5e.items");

		let i = 0;

		let output = [];

		pack.getIndex().then(index => index.forEach(function (arrayItem) {
			var x = arrayItem._id;
			//console.log(arrayItem);
			i++;
			pack.getEntity(arrayItem._id).then(packItem => {

				if (packItem.type === type) {

					//console.log(packItem);

					let newItem = {
						"_id": packItem._id,
						"flags": {},
						"type": 1,
						"text": packItem.name,
						"img": packItem.img,
						"collection": "Item",
						"resultId": packItem._id,
						"weight": 1,
						"range": [
							i,
							i
						],
						"drawn": false
					};

					output.push(newItem);

		}
			});
		}));

		console.log(output);
		return;
	}

	/* -------------------------------------------- */

	/**
	 * Handle sheet type change
	 * @private
	 */
	async _changeSheetType(event, html) {
		event.preventDefault();
		console.log("Ficha Loot | Sheet Type changed", event);

		let currentActor = this.actor;

		let selectedIndex = event.target.selectedIndex;

		let selectedItem = event.target[selectedIndex].value;

		await currentActor.setFlag("fichaloott20", "lootsheettype", selectedItem);

	}

	/* -------------------------------------------- */

	/**
	 * Handle buy item
	 * @private
	 */
	_buyItem(event, all = 0) {
		event.preventDefault();
		console.log("Ficha Loot | Buy Item clicked");

		let targetGm = null;
		game.users.forEach((u) => {
			if (u.isGM && u.active && u.viewedScene === game.user.viewedScene) {
				targetGm = u;
			}
		});

		if (!targetGm) {
			return ui.notifications.error("Não há Mestre ativo na sua cena. Ele deve estar online e na mesma cena para você poder comprar um item.");
		}

		if (this.token === null) {
			return ui.notifications.error(`Você deve comprar o item de um token.`);
		}
		if (!game.user.actorId) {
			console.log("Ficha Loot | No active character for user");
			return ui.notifications.error(`Não há personagens ativos para o usuário.`);
		}

		let itemId = $(event.currentTarget).parents(".item").attr("data-item-id");
		const item = this.actor.getEmbeddedEntity("Item", itemId);

		const packet = {
			type: "buy",
			buyerId: game.user.actorId,
			tokenId: this.token.id,
			itemId: itemId,
			qtd: 1,
			processorId: targetGm.id
		};

		if (all || event.shiftKey) {
			packet.qtd = item.data.data.qtd;
		}

		if (item.data.data.qtd === packet.qtd) {
			console.log("LootSheet5e", "Sending buy request to " + targetGm.name, packet);
			game.socket.emit(LootSheet5eNPC.SOCKET, packet);
			return;
		}

		let d = new QuantityDialog((quantity) => {
			packet.qtd = quantity;
			console.log("LootSheet5e", "Sending buy request to " + targetGm.name, packet);
			game.socket.emit(LootSheet5eNPC.SOCKET, packet);
		},
			{
				acceptLabel: "Comprar"
			}
		);
		d.render(true);
	}

	/* -------------------------------------------- */

	/**
	 * Handle Loot item
	 * @private
	 */
	_lootItem(event, all = 0) {
		event.preventDefault();
		console.log("Ficha Loot | Loot Item clicked");

		let targetGm = null;
		game.users.forEach((u) => {
			if (u.isGM && u.active && u.viewedScene === game.user.viewedScene) {
				targetGm = u;
			}
		});

		if (!targetGm) {
			return ui.notifications.error("Não há Mestre ativo na sua cena. Ele deve estar online e na mesma cena para você poder comprar um item.");
		}

		if (this.token === null) {
			return ui.notifications.error(`Você precisa pilhar itens de um token.`);
		}
		if (!game.user.actorId) {
			console.log("Ficha Loot | No active character for user");
			return ui.notifications.error(`Não há personagens ativos para o usuário.`);
		}

		const itemId = $(event.currentTarget).parents(".item").attr("data-item-id");
		const targetItem = this.actor.getEmbeddedEntity("Item", itemId);

		const item = { itemId: itemId, quantity: 1 };
		if (all || event.shiftKey) {
			item.quantity = targetItem.data.data.qtd;
		}

		const packet = {
			type: "loot",
			looterId: game.user.actorId,
			tokenId: this.token.id,
			items: [item],
			processorId: targetGm.id
		};

		if (targetItem.data.data.qtd === item.quantity) {
			console.log("LootSheet5e", "Sending loot request to " + targetGm.name, packet);
			game.socket.emit(LootSheet5eNPC.SOCKET, packet);
			return;
		}

		const d = new QuantityDialog((quantity) => {
			packet.items[0]['quantity'] = quantity;
			console.log("LootSheet5e", "Sending loot request to " + targetGm.name, packet);
			game.socket.emit(LootSheet5eNPC.SOCKET, packet);
		},
			{
				acceptLabel: "Loot"
			}
		);
		d.render(true);
	}

	/* -------------------------------------------- */

	/**
	 * Handle Loot coins
	 * @private
	 */
	_lootCoins(event) {
		event.preventDefault();
		if (!game.settings.get("fichaloott20", "lootCurrency")) {
			return;
		}
		console.log("Ficha Loot | Loot Coins clicked");

		let targetGm = null;
		game.users.forEach((u) => {
			if (u.isGM && u.active && u.viewedScene === game.user.viewedScene) {
				targetGm = u;
			}
		});

		if (!targetGm) {
			return ui.notifications.error("Não há Mestre ativo na sua cena. Ele deve estar online e na mesma cena para você poder pilhar moedas.");
		}

		if (this.token === null) {
			return ui.notifications.error(`Você precisa pilhar moedas de um token.`);
		}
		if (!game.user.actorId) {
			console.log("Ficha Loot | No active character for user");
			return ui.notifications.error(`Não há personagens ativos para o usuário.`);
		}

		const packet = {
			type: "lootCoins",
			looterId: game.user.actorId,
			tokenId: this.token.id,
			processorId: targetGm.id
		};
		console.log("LootSheet5e", "Sending loot request to " + targetGm.name, packet);
		game.socket.emit(LootSheet5eNPC.SOCKET, packet);
	}

	/* -------------------------------------------- */

	/**
	 * Handle Loot all
	 * @private
	 */
	_lootAll(event, html) {
		event.preventDefault();
		console.log("Ficha Loot | Loot All clicked");
		this._lootCoins(event);

		let targetGm = null;
		game.users.forEach((u) => {
			if (u.isGM && u.active && u.viewedScene === game.user.viewedScene) {
				targetGm = u;
			}
		});

		if (!targetGm) {
			return ui.notifications.error("Não há Mestre ativo na sua cena. Ele deve estar online e na mesma cena para você poder comprar um item.");
		}

		if (this.token === null) {
			return ui.notifications.error(`Você precisa pilhar itens de um token.`);
		}
		if (!game.user.actorId) {
			console.log("Ficha Loot | No active character for user");
			return ui.notifications.error(`Não há personagens ativos para o usuário.`);
		}

		const itemTargets = html.find('.item[data-item-id]');
		if (!itemTargets) {
			return;
		}

		const items = [];
		for (let i of itemTargets) {
			const itemId = i.getAttribute("data-item-id");
			const item = this.actor.getEmbeddedEntity("OwnedItem", itemId);
			items.push({ itemId: itemId, quantity: item.data.qtd });
		}
		if (items.length === 0) {
			return;
		}

		const packet = {
			type: "loot",
			looterId: game.user.actorId,
			tokenId: this.token.id,
			items: items,
			processorId: targetGm.id
		};

		console.log("LootSheet5e", "Sending loot request to " + targetGm.name, packet);
		game.socket.emit(LootSheet5eNPC.SOCKET, packet);
	}

	/* -------------------------------------------- */

	/**
	 * Handle price modifier
	 * @private
	 */
	async _priceModifier(event) {
		event.preventDefault();
		//console.log("Ficha Loot | Price Modifier clicked");
		//console.log(this.actor.isToken);

		let priceModifier = await this.actor.getFlag("fichaloott20", "priceModifier");
		if (!priceModifier) priceModifier = 1.0;

		priceModifier = Math.round(priceModifier * 100);

		var html = "<p>Use este slider para modificar o preço de todos os itens neste inventário. <i class='fa fa-question-circle' title='100% é o preço padrão, 0% é 0, 200% é o dobro do preço.'></i></p>";
		html += '<p><input name="price-modifier-percent" id="price-modifier-percent" type="range" min="0" max="200" value="' + priceModifier + '" class="slider"></p>';
		html += '<p><label>Porcentagem:</label> <input type=number min="0" max="200" value="' + priceModifier + '" id="price-modifier-percent-display"></p>';
		html += '<script>var pmSlider = document.getElementById("price-modifier-percent"); var pmDisplay = document.getElementById("price-modifier-percent-display"); pmDisplay.value = pmSlider.value; pmSlider.oninput = function() { pmDisplay.value = this.value; }; pmDisplay.oninput = function() { pmSlider.value = this.value; };</script>';

		let d = new Dialog({
			title: "Modificador de Preço",
			content: html,
			buttons: {
				one: {
					icon: '<i class="fas fa-check"></i>',
					label: "Atualizar",
					callback: () => this.actor.setFlag("fichaloott20", "priceModifier", document.getElementById("price-modifier-percent").value / 100)
				},
				two: {
					icon: '<i class="fas fa-times"></i>',
					label: "Cancelar",
					callback: () => console.log("Ficha Loot | Price Modifier Cancelled")
				}
			},
			default: "two",
			close: () => console.log("Ficha Loot | Price Modifier Closed")
		});
		d.render(true);
	}

	/* -------------------------------------------- */

	/**
	 * Handle distribution of coins
	 * @private
	 */
	_distributeCoins(event) {
		event.preventDefault();
		//console.log("Ficha Loot | Split Coins clicked");

		let targetGm = null;
		game.users.forEach((u) => {
			if (u.isGM && u.active && u.viewedScene === game.user.viewedScene) {
				targetGm = u;
			}
		});

		if (!targetGm) {
			return ui.notifications.error("Não há Mestre ativo na sua cena. Ele deve estar online e na mesma cena para você poder comprar um item.");
		}

		if (this.token === null) {
			return ui.notifications.error(`Você precisa pilhar itens de um token.`);
		}

		if (game.user.isGM) {
			//don't use socket
			let container = canvas.tokens.get(this.token.id);
			this._hackydistributeCoins(container.actor);
			return;
		}

		const packet = {
			type: "distributeCoins",
			looterId: game.user.actorId,
			tokenId: this.token.id,
			processorId: targetGm.id
		};
		console.log("LootSheet5e", "Sending distribute coins request to " + targetGm.name, packet);
		game.socket.emit(LootSheet5eNPC.SOCKET, packet);
	}

	_hackydistributeCoins(containerActor) {
		let actorData = containerActor.data
		let observers = [];
		let players = game.users.players;
		// Calculate observers
				for (let player of players) {
						let playerPermission = LootSheet5eNPCHelper.getLootPermissionForPlayer(actorData, player);
						if (player != "default" && playerPermission >= 2) {
				let actor = game.actors.get(player.data.character);
				if (actor !== null && (player.data.role === 1 || player.data.role === 2)) observers.push(actor);
			}
		}
		if (observers.length === 0) return;

		// Calculate split of currency
		let currencySplit = duplicate(actorData.data.detalhes.dinheiro);

		// keep track of the remainder
		let currencyRemainder = {};

		for (let c in currencySplit) {
			if (observers.length) {
				// calculate remainder
				currencyRemainder[c] = (currencySplit[c] % observers.length);

				currencySplit[c] = Math.floor(currencySplit[c] / observers.length);
			}
			else currencySplit[c] = 0;
		}

		// add currency to actors existing coins
		let msg = [];
		for (let u of observers) {
			if (u === null) continue;

			msg = [];
			let currency = u.data.data.detalhes.dinheiro,
				newCurrency = duplicate(u.data.data.detalhes.dinheiro);

			for (let c in currency) {
				// add msg for chat description
				if (currencySplit[c]) {
					//console.log("Ficha Loot | New currency for " + c, currencySplit[c]);
					let moedas = c.toUpperCase();
					msg.push(` ${currencySplit[c]} ${moedas}`)
				}
				if (currencySplit[c] != null) {
					// Add currency to permitted actor
					newCurrency[c] = parseInt(currency[c] || 0) + currencySplit[c];
					u.update({
						'data.detalhes.dinheiro': newCurrency
					});
				}
			}

			// Remove currency from loot actor.
			let lootCurrency = containerActor.data.data.detalhes.dinheiro,
				zeroCurrency = {};

			for (let c in lootCurrency) {
				zeroCurrency[c] = {
					'type': currencySplit[c].type,
					'label': currencySplit[c].type,
					'value': currencyRemainder[c]
				}
				containerActor.update({
					"data.detalhes.dinheiro": zeroCurrency
				});
			}

			// Create chat message for coins received
			if (msg.length != 0) {
				let message = `${u.data.name} recebeu `;
				message += msg.join(",");
				ChatMessage.create({
					user: game.user._id,
					speaker: {
						actor: containerActor,
						alias: containerActor.name
					},
					content: message
				});
			}
		}
	}

	/* -------------------------------------------- */

	/**
	 * Handle cycling permissions
	 * @private
	 */
	_onCyclePermissionProficiency(event) {

		event.preventDefault();

		//console.log("Ficha Loot | this.actor.data.permission", this.actor.data.permission);


		let actorData = this.actor.data;


		let field = $(event.currentTarget).siblings('input[type="hidden"]');

		let level = parseFloat(field.val());
		if (typeof level === undefined) level = 0;

		//console.log("Ficha Loot | current level " + level);

		const levels = [0, 3, 2]; //const levels = [0, 2, 3];

		let idx = levels.indexOf(level),
			newLevel = levels[(idx === levels.length - 1) ? 0 : idx + 1];

		//console.log("Ficha Loot | new level " + newLevel);

		let playerId = field[0].name;

		//console.log("Ficha Loot | Current actor: " + playerId);

		this._updatePermissions(actorData, playerId, newLevel, event);

		this._onSubmit(event);
	}

	/* -------------------------------------------- */

	/**
	 * Handle cycling bulk permissions
	 * @private
	 */
	_onCyclePermissionProficiencyBulk(event) {
		event.preventDefault();

		let actorData = this.actor.data;

		let field = $(event.currentTarget).parent().siblings('input[type="hidden"]');
		let level = parseFloat(field.val());
		if (typeof level === undefined || level === 999) level = 0;

		const levels = [0, 3, 2]; //const levels = [0, 2, 3];

		let idx = levels.indexOf(level),
			newLevel = levels[(idx === levels.length - 1) ? 0 : idx + 1];

		let users = game.users.entities;

		let currentPermissions = duplicate(actorData.permission);
		for (let u of users) {
			if (u.data.role === 1 || u.data.role === 2) {
				currentPermissions[u._id] = newLevel;
			}
		}
		const lootPermissions = new PermissionControl(this.actor);
		lootPermissions._updateObject(event, currentPermissions)

		this._onSubmit(event);
	}

	_updatePermissions(actorData, playerId, newLevel, event) {
		// Read player permission on this actor and adjust to new level
		let currentPermissions = duplicate(actorData.permission);
		currentPermissions[playerId] = newLevel;
		// Save updated player permissions
		const lootPermissions = new PermissionControl(this.actor);
		lootPermissions._updateObject(event, currentPermissions);
	}

	/* -------------------------------------------- */

	/**
	 * Organize and classify Items for Loot NPC sheets
	 * @private
	 */
	_prepareItems(actorData) {

		//console.log("Ficha Loot | Prepare Features");
		// Actions
		const features = {
			weapons: {
				label: "Armas",
				items: [],
				type: "arma"
			},
			equipment: {
				label: "Equipamentos",
				items: [],
				type: "equip"
			},
			consumables: {
				label: "Consumíveis",
				items: [],
				type: "consumivel"
			},
			loot: {
				label: "Tesouro",
				items: [],
				type: "tesouro"
			},
		};

		//console.log("Ficha Loot | Prepare Items");
		// Iterate through items, allocating to containers
		let items = actorData.items;
		items = items.sort(function (a, b) {
			return a.name.localeCompare(b.name);
		});
		for (let i of items) {
			i.img = i.img || DEFAULT_TOKEN;
			//console.log("Ficha Loot | item", i);

			// Features
			if (i.type === "arma") features.weapons.items.push(i);
			else if (i.type === "equip") features.equipment.items.push(i);
			else if (i.type === "consumivel") features.consumables.items.push(i);
			else if (i.type === "tesouro") features.loot.items.push(i);
			else features.loot.items.push(i);
		}

		// Assign and return
		//actorData.features = features;
		actorData.actor.features = features;
		//console.log(this.actor);
	}

	/* -------------------------------------------- */


	/**
	 * Get the font-awesome icon used to display the permission level.
	 * @private
	 */
	_getPermissionIcon(level) {
		const icons = {
			0: '<i class="far fa-circle"></i>',
			2: '<i class="fas fa-eye"></i>',
			3: '<i class="fas fa-check"></i>',
			999: '<i class="fas fa-users"></i>'
		};
		return icons[level];
	}

	/* -------------------------------------------- */

	/**
	 * Get the font-awesome icon used to display the permission level.
	 * @private
	 */
	_getPermissionDescription(level) {
		const description = {
			0: "Nenhum (não consegue acessar a ficha)",
			2: "Observador (acesso à ficha, mas só consegue comprar itens se for uma ficha de Loja)",
			3: "Dono (acesso aos itens e distribuição de moedas)",
			999: "Mudar todas as permissões"
		};
		return description[level];
	}


	/* -------------------------------------------- */

	/**
	 * Prepares GM settings to be rendered by the loot sheet.
	 * @private
	 */
	_prepareGMSettings(actorData) {
				const playerData = [],
			observers = [];
			
				let players = game.users.players;
		let commonPlayersPermission = -1;

		//console.log("Loot Sheet _prepareGMSettings | actorData.permission", actorData.permission);

				for (let player of players)
				{
						//console.log("Ficha Loot | Checking user " + player.data.name, player);

						// get the name of the primary actor for a player
						const actor = game.actors.get(player.data.character);
						//console.log("Ficha Loot | Checking actor", actor);
						
						if (actor) {
								player.actor = actor.data.name;
								player.actorId = actor.data._id;
								player.playerId = player.data._id;

								player.lootPermission = LootSheet5eNPCHelper.getLootPermissionForPlayer(actorData, player);

								if (player.lootPermission >= 2 && !observers.includes(actor.data._id))
								{
						observers.push(actor.data._id);
				}

				//Set icons and permission texts for html
								//console.log("Ficha Loot | lootPermission", player.lootPermission);
				if (commonPlayersPermission < 0) {
										commonPlayersPermission = player.lootPermission;
								} else if (commonPlayersPermission !== player.lootPermission) {
					commonPlayersPermission = 999;
				}
								
								player.icon = this._getPermissionIcon(player.lootPermission);
								player.lootPermissionDescription = this._getPermissionDescription(player.lootPermission);
								playerData.push(player);
			}
		}

		// calculate the split of coins between all observers of the sheet.
		let currencySplit = duplicate(actorData.data.detalhes.dinheiro);
		for (let c in currencySplit) {
			if (observers.length)
				if (currencySplit[c] != null) currencySplit[c] = Math.floor(currencySplit[c] / observers.length);
			else
				currencySplit[c] = 0
		}

		let loot = {}
				loot.players = playerData;
		loot.observerCount = observers.length;
		loot.currency = currencySplit;
		loot.playersPermission = commonPlayersPermission;
		loot.playersPermissionIcon = this._getPermissionIcon(commonPlayersPermission);
		loot.playersPermissionDescription = this._getPermissionDescription(commonPlayersPermission);
		actorData.flags.loot = loot;
	}

}

//Register the loot sheet
Actors.registerSheet("tormenta20", LootSheet5eNPC, {
	types: ["npc"],
	makeDefault: false,
	label: "Ficha Loot T20"
});


/**
 * Register a hook to convert any spell created on an actor with the LootSheet5eNPC sheet to a consumable scroll.
 */
Hooks.on('preCreateOwnedItem', (actor, item, data) => {

	if (!actor) throw new Error(`Parent Actor ${actor._id} not found`);

	// Check if Actor is an NPC
	if (actor.data.type === "character") return;

	// If the actor is using the LootSheet5eNPC then check in the item is a spell and if so update the name.
	if ((actor.data.flags.core || {}).sheetClass === "tormenta20.LootSheet5eNPC") {
		if (item.type === "magia") {
			let changeScrollIcon = game.settings.get("fichaloott20", "changeScrollIcon");

			if (changeScrollIcon) item.img = "modules/fichaloott20/icons/Scroll" + item.data.circulo + ".webp";

			item.name = "Pergaminho de " + item.name;
			item.type = "consumivel";
		}
	} else return;

});

Hooks.once("init", () => {

	Handlebars.registerHelper('ifeq', function (a, b, options) {
		if (a == b) { return options.fn(this); }
		return options.inverse(this);
	});

	game.settings.register("fichaloott20", "changeScrollIcon", {
		name: "Mudar ícone para Pergaminhos?",
		hint: "Muda o ícone de magias para o ícone de pergaminhos.",
		scope: "world",
		config: true,
		default: true,
		type: Boolean
	});

	game.settings.register("fichaloott20", "buyChat", {
		name: "Mostrar mensagem de chat para compras?",
		hint: "Uma mensagem de chat irá mostrar as compras de itens.",
		scope: "world",
		config: true,
		default: true,
		type: Boolean
	});

	game.settings.register("fichaloott20", "lootCurrency", {
		name: "Pilhar moedas?",
		hint: "Jogadores terão a opção de pilhar todas as moedas para seu personagem, além de poder distribuir entre os jogadores.",
		scope: "world",
		config: true,
		default: true,
		type: Boolean
	});

	game.settings.register("fichaloott20", "lootAll", {
		name: "Pilhar tudo?",
		hint: "Jogadores terão a opção de pilhar todos os itens para seu personagem. Moedas irão seguir a configuração Pilhar moedas?' ao Pilhar Tudo.",
		scope: "world",
		config: true,
		default: true,
		type: Boolean
	});

	game.settings.register("fichaloott20", "showStackWeight", {
		name: "Mostrar peso da pilha?",
		hint: "Mostra o peso da pilha inteira próximo ao peso do item.",
		scope: "world",
		config: true,
		default: false,
		type: Boolean
	});

	game.settings.register("fichaloott20", "reduceUpdateVerbosity", {
		name: "Reduzir Verbosidade da Atualização da Loja",
		hint: "Notificações não serão criadas toda vez que um novo item for adicionado à loja.",
		scope: "world",
		config: true,
		default: true,
		type: Boolean
	});

	function chatMessage(speaker, owner, message, item) {
		if (game.settings.get("fichaloott20", "buyChat")) {
			message = `
			<div class="tormenta20 chat-card item-card" data-actor-id="${owner._id}" data-item-id="${item._id}">
				<header class="card-header flexrow">
					<img src="${item.img}" title="${item.name}" width="36" height="36">
					<h3 class="item-name">${item.name}</h3>
				</header>

				<div class="message-content">
					<p>` + message + `</p>
				</div>
			</div>
			`;
			ChatMessage.create({
				user: game.user._id,
				speaker: {
					actor: speaker,
					alias: speaker.name
				},
				content: message
			});
		}
	}

	function errorMessageToActor(target, message) {
		game.socket.emit(LootSheet5eNPC.SOCKET, {
			type: "error",
			targetId: target.id,
			message: message
		});
	}

	async function moveItems(source, destination, items) {
		const updates = [];
		const deletes = [];
		const additions = [];
		const destUpdates = [];
		const results = [];
		for (let i of items) {
			let itemId = i.itemId;
			let quantity = i.quantity;
			let item = source.getEmbeddedEntity("Item", itemId);

			// Move all items if we select more than the quantity.
			if (item.data.data.qtd < quantity) {
				quantity = item.data.data.qtd;
			}

			let newItem = duplicate(item);
			const update = { _id: itemId, "data.qtd": item.data.data.qtd - quantity };

			if (update["data.qtd"] === 0) {
				deletes.push(itemId);
			}
			else {
				updates.push(update);
			}

			newItem.data.data.qtd = quantity;
			results.push({
				item: newItem,
				quantity: quantity
			});
			additions.push(newItem);
		}

		if (deletes.length > 0) {
			await source.deleteEmbeddedEntity("Item", deletes);
		}

		if (updates.length > 0) {
			await source.updateEmbeddedEntity("Item", updates);
		}

		if (additions.length > 0) {
			await destination.createEmbeddedEntity("Item", additions);
		}

		if (destUpdates.length > 0) {
			await destination.updateEmbeddedDocuments("Item", destUpdates);
		}

		return results;
	}

	async function lootItems(container, looter, items) {
		let moved = await moveItems(container, looter, items);

		for (let m of moved) {
			chatMessage(
				container, looter,
				`${looter.name} pilhou ${m.quantity} x ${m.item.name}.`,
				m.item);
		}
	}

	async function transaction(seller, buyer, itemId, quantity) {
		let sellItem = seller.getEmbeddedEntity("Item", itemId);

		// If the buyer attempts to buy more then what's in stock, buy all the stock.
		if (sellItem.data.data.qtd < quantity) {
			quantity = sellItem.data.data.qtd;
		}

		// On negative quantity we show an error
		if (quantity < 0) {
			errorMessageToActor(buyer, `Não é possível comprar uma quantidade negativa de itens.`);
			return;
		}
		// On 0 quantity skip everything to avoid error down the line
		else if (quantity == 0) {
			errorMessageToActor(buyer, `Não existem itens suficientes no vendedor.`);
			return;
		}

		let sellerModifier = seller.getFlag("fichaloott20", "priceModifier");
		if (!sellerModifier) sellerModifier = 1.0;

		let itemCost = Math.round(sellItem.data.data.preco * sellerModifier * 100) / 100;
		itemCost *= quantity;
		let buyerFunds = duplicate(buyer.data.data.detalhes.dinheiro);
		if (buyerFunds["tt"] != undefined) delete buyerFunds["tt"];
		const conversionRates = {
			"tl": 1,
			"to": 1/10, 
			"tp": 1/100,
			"tc": 1/1000
		};

		const compensationCurrency = {"tl": "to", "to": "tp", "tp": "tc"};
		 
		let itemCostInPlatinum = itemCost * conversionRates["tp"]
		
		let buyerFundsAsPlatinum =
			buyerFunds["tl"]
			+ buyerFunds["to"] * conversionRates["to"]
			+ buyerFunds["tp"] * conversionRates["tp"]
			+ buyerFunds["tc"] * conversionRates["tc"];

		if (itemCostInPlatinum > buyerFundsAsPlatinum) {
			errorMessageToActor(buyer, `Dinheiro insuficiente para comprar o item.`);
			return;
		}

		let convertCurrency = false; //game.settings.get("fichaloott20", "convertCurrency");

		if (convertCurrency) {
			pass;
			/*
			buyerFundsAsPlatinum -= itemCostInPlatinum;

			// Remove every coin we have
			for (let currency in buyerFunds) {
				buyerFunds[currency] = 0;
			}

			// Give us fractions of platinum coins, which will be smoothed out below
			buyerFunds["pp"] = buyerFundsAsPlatinum
			*/
		}
		else {
			// We just pay in partial platinum. 
			// We dont care if we get partial coins or negative once because we compensate later		
			buyerFunds["tl"] -= itemCostInPlatinum

			// Now we exchange all negative funds with coins of lower value
			// We dont need to care about running out of money because we checked that earlier
			for (let currency in buyerFunds) {
				let amount = buyerFunds[currency]
				// console.log(`${currency} : ${amount}`);
				if (amount >= 0) continue;
				
				// If we have ever so slightly negative cp, it is likely due to floating point error
				// We dont care and just give it to the player
				if (currency == "tc") {
					buyerFunds["tc"] = 0;
					continue;
				}

				let compCurrency = compensationCurrency[currency]

				buyerFunds[currency] = 0;
				buyerFunds[compCurrency] += amount * 10; // amount is a negative value so we add it
				// console.log(`Substracted: ${amount * conversionRates[compCurrency]} ${compCurrency}`);
			}
		}

		// Finally we exchange partial coins with as little change as possible
		for (let currency in buyerFunds) {
			let amount = buyerFunds[currency]

			// We round to 5 decimals. 1 pp is 1000cp, so 5 decimals always rounds good enough
			// We need to round because otherwise we get 15.99999999999918 instead of 16 due to floating point precision
			// If we would floor 15.99999999999918 everything explodes
			let newFund = Math.floor(Math.round(amount * 1e5) / 1e5);
			buyerFunds[currency] = newFund;

			let compCurrency = compensationCurrency[currency]

			// We dont care about fractions of CP
			if (currency != "tc") {
				// We calculate the amount of lower currency we get for the fraction of higher currency we have
				let toAdd = Math.round((amount - newFund) * 1e5) / 1e5 * conversionRates[compCurrency]
				buyerFunds[compCurrency] += toAdd
			}
		}

		// Update buyer's gold from the buyer.
		buyer.update({ "data.detalhes.dinheiro": buyerFunds });
		let moved = await moveItems(seller, buyer, [{ itemId, quantity }]);

		for (let m of moved) {
			chatMessage(
				seller, buyer,
				`${buyer.name} comprou ${quantity} x ${m.item.name} por T$ ${itemCost}.`,
				m.item);
		}
	}

	function distributeCoins(containerActor) {
		let actorData = containerActor.data
		let observers = [];
				let players = game.users.players;

		// Calculate observers
				for (let player of players) {
						let playerPermission = LootSheet5eNPCHelper.getLootPermissionForPlayer(actorData, player);
						if (player != "default" && playerPermission >= 2) {
				let actor = game.actors.get(player.data.character);
				if (actor !== null && (player.data.role === 1 || player.data.role === 2)) observers.push(actor);
			}
		}

		if (observers.length === 0) return;

		// Calculate split of currency
		let currencySplit = duplicate(actorData.data.detalhes.dinheiro);

		// keep track of the remainder
		let currencyRemainder = {};

		for (let c in currencySplit) {
			if (observers.length) {
				// calculate remainder
				currencyRemainder[c] = (currencySplit[c] % observers.length);

				currencySplit[c] = Math.floor(currencySplit[c] / observers.length);
			}
			else currencySplit[c] = 0;
		}

		// add currency to actors existing coins
		let msg = [];
		for (let u of observers) {
			if (u === null) continue;

			msg = [];
			let currency = u.data.data.detalhes.dinheiro,
				newCurrency = duplicate(u.data.data.detalhes.dinheiro);

			for (let c in currency) {
				// add msg for chat description
				if (currencySplit[c]) {
					msg.push(` ${currencySplit[c]} ${c}`)
				}

				// Add currency to permitted actor
				newCurrency[c] = parseInt(currency[c] || 0) + currencySplit[c];

				u.update({
					'data.detalhes.dinheiro': newCurrency
				});
			}

			// Remove currency from loot actor.
			let lootCurrency = containerActor.data.data.detalhes.dinheiro,
				zeroCurrency = {};

			for (let c in lootCurrency) {
				zeroCurrency[c] = {
					'type': currencySplit[c].type,
					'label': currencySplit[c].type,
					'value': currencyRemainder[c]
				}
				containerActor.update({
					"data.detalhes.dinheiro": zeroCurrency
				});
			}

			// Create chat message for coins received
			if (msg.length != 0) {
				let message = `${u.data.name} recebeu `;
				message += msg.join(",");
				ChatMessage.create({
					user: game.user._id,
					speaker: {
						actor: containerActor,
						alias: containerActor.name
					},
					content: message
				});
			}
		}
	}

	function lootCoins(containerActor, looter) {
		let actorData = containerActor.data

		let sheetCurrency = actorData.data.detalhes.dinheiro;

		// add currency to actors existing coins
		let msg = [];
		let currency = looter.data.data.detalhes.dinheiro,
			newCurrency = duplicate(looter.data.data.detalhes.dinheiro);

		for (let c in currency) {
			// add msg for chat description
			if (sheetCurrency[c].value) {
				msg.push(` ${sheetCurrency[c].value} ${c} coins`)
			}
			if (sheetCurrency[c].value != null) {
				// Add currency to permitted actor
				newCurrency[c] = parseInt(currency[c] || 0) + parseInt(sheetCurrency[c].value);
				looter.update({
					'data.detalhes.dinheiro': newCurrency
				});
			}
		}

		// Remove currency from loot actor.
		let lootCurrency = containerActor.data.data.detalhes.dinheiro,
			zeroCurrency = {};

		for (let c in lootCurrency) {
			zeroCurrency[c] = {
				'type': sheetCurrency[c].type,
				'label': sheetCurrency[c].type,
				'value': 0
			}
			containerActor.update({
				"data.detalhes.dinheiro": zeroCurrency
			});
		}

		// Create chat message for coins received
		if (msg.length != 0) {
			let message = `${looter.data.name} recebeu `;
			message += msg.join(",");
			ChatMessage.create({
				user: game.user._id,
				speaker: {
					actor: containerActor,
					alias: containerActor.name
				},
				content: message
			});
		}
	}

	game.socket.on(LootSheet5eNPC.SOCKET, data => {
		console.log("Ficha Loot | Socket Message: ", data);
		if (game.user.isGM && data.processorId === game.user.id) {
			if (data.type === "buy") {
				let buyer = game.actors.get(data.buyerId);
				let seller = canvas.tokens.get(data.tokenId);

				if (buyer && seller && seller.actor) {
					transaction(seller.actor, buyer, data.itemId, data.qtd);
				}
				else if (!seller) {
					errorMessageToActor(buyer, "Mestre indisponível. O Mestre precisa estar na mesma cena para você poder comprar um item.")
					ui.notifications.error("Jogador tentou comprar um item em uma cena diferente.");
				}
			}

			if (data.type === "loot") {
				let looter = game.actors.get(data.looterId);
				let container = canvas.tokens.get(data.tokenId);

				if (looter && container && container.actor) {
					lootItems(container.actor, looter, data.items);
				}
				else if (!container) {
					errorMessageToActor(looter, "Mestre indisponível. O Mestre precisa estar na mesma cena para você poder pilhar um item.")
					ui.notifications.error("Jogador tentou pilhar um item em uma cena diferente.");
				}
			}

			if (data.type === "distributeCoins") {
				let container = canvas.tokens.get(data.tokenId);
				if (!container || !container.actor) {
					errorMessageToActor(looter, "Mestre indisponível. O Mestre precisa estar na mesma cena para você poder distribuir moedas.")
					return ui.notifications.error("Jogador tentou distribuir moedas em uma cena diferente.");
				}
				distributeCoins(container.actor);
			}

			if (data.type === "lootCoins") {
				let looter = game.actors.get(data.looterId);
				let container = canvas.tokens.get(data.tokenId);
				if (!container || !container.actor || !looter) {
					errorMessageToActor(looter, "Mestre indisponível. O Mestre precisa estar na mesma cena para você poder pilhar moedas.")
					return ui.notifications.error("Jogador tentou pilhar moedas em uma cena diferente.");
				}
				lootCoins(container.actor, looter);
			}
		}
		if (data.type === "error" && data.targetId === game.user.actorId) {
			console.log("Ficha Loot | Transaction Error: ", data.message);
			return ui.notifications.error(data.message);
		}
	});


});
