# Ficha de Loot T20

Este módulo adiciona uma ficha de NPC adicional que pode ser usada para recipientes, como baús. Ele também permite que magias sejam automaticamente convertidas em pergaminhos.

Este módulo é uma bifurcação do módulo do jopeek (https://github.com/jopeek/fvtt-loot-sheet-npc-5e), feito para D&D 5e.

### Descrição

Permite reunir itens e moedas para serem distribuídos aos jogadores.

##### Permissões
Permissões podem ser definidas na ficha para cada jogador e variam entre Sem Acesso, Observador e Dono..

![demo_permissions](https://thumbs.gfycat.com/CaringWildKoi-size_restricted.gif)

##### Ficha de Loja
Pode ser usada para criar um inventário de uma loja para permitir que os jogadores olhem os itens.

![demo_inventory](https://raw.githubusercontent.com/jopeek/fvtt-loot-sheet-npc-5e/master/images/demo_inventory.jpg)

###### Modificador de Preço
Preços podem ser ajustados por porcentagem para todos os itens.

![price_modifier](https://thumbs.gfycat.com/WelloffFortunateInganue-size_restricted.gif)

Uma aba de Biografia também está disponível.

![demo_biography](https://raw.githubusercontent.com/jopeek/fvtt-loot-sheet-npc-5e/master/images/demo_biography.jpg)

##### Distruição de Moedas
Quaisquer moedas na ficha podem ser facilmente dividas igualmente entre todos os jogadores com acesso de Dono. O cálculo e distribuição é feito em um clique para o Mestre.

![demo_splitcoins](https://thumbs.gfycat.com/ElementaryDependentGalapagosdove-size_restricted.gif)

##### Criando Pergaminhos de Magia
Arrastar magias para dentro da ficha vai transformá-la automaticamente em um pergaminho.

![demo_scrolls](https://thumbs.gfycat.com/LividAccurateFluke-size_restricted.gif)

### Compatibilidade:
- Testado com FVTT v0.7.9.

### Problemas Conhecidos
- Arrastar um item para fora da ficha não o remove de fato do estoque da ficha.
- O Modificador de Preço não salva o preço do item no Token. O dev original acredita que isso seja um problema do próprio FoundryVTT. 
- 0% no Modificador de Preço não altera o preço do item.

### Instruções de Instalação

1. No FVTT, vá na aba Módulos
2. Clique no botão Instalar Módulo e coloque a seguinte URL: https://raw.githubusercontent.com/mclemente/fvtt-ficha-loot-t20/master/module.json
3. Clique em  Instalar e espere a instalação ser completada.

### Feedback

Sugestões ou feedback, entre em contato comigo no Discord (mclemente#5524).