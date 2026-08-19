// slots-data.js  装備・ペットのスロット定義
//
// data/slots.yaml から Hugo が生成する。直接編集しないこと。
// 定義を変えるときは data/slots.yaml を編集する。
//
// key   HTMLのID接尾辞（select_weapon / level_weapon など）と状態のキー
// label 画面に出すスロット名
//
// 配列の順序がそのまま表示順になる。
// 補助関数 slotKeys / slotLabelMap は js/common/game-data.js にある。
//
// トップレベルの const 宣言を持つため、同一ページで二重に読み込まないこと。
{{ $groups := slice
     (dict "name" "ARMOR_SLOTS_DEF"     "items" site.Data.slots.armor)
     (dict "name" "ACCESSORY_SLOTS_DEF" "items" site.Data.slots.accessory)
     (dict "name" "PET_SLOTS_DEF"       "items" site.Data.slots.pet) }}
{{- range $g := $groups }}
const {{ $g.name }} = [
{{- range $i, $s := $g.items }}
  { key: "{{ $s.key }}", label: "{{ $s.label }}" }{{ if lt (add $i 1) (len $g.items) }},{{ end }}
{{- end }}
];
{{ end -}}
