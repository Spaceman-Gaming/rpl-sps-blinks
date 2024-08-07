/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/rpl_sps_blinks.json`.
 */
export type RplSpsBlinks = {
  "address": "7M5gyKT88N9fViSMjNcizfq5Rtz9CSLN8agu7r7TRULY",
  "metadata": {
    "name": "rplSpsBlinks",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "Created with Anchor"
  },
  "docs": [
    ""
  ],
  "instructions": [
    {
      "name": "buyGoods",
      "docs": [
        "* Buy Goods allows blink users to contribute funds to a SPS on a time locked basis"
      ],
      "discriminator": [
        15,
        10,
        48,
        68,
        183,
        196,
        194,
        171
      ],
      "accounts": [
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        },
        {
          "name": "payer",
          "writable": true,
          "signer": true
        },
        {
          "name": "authority",
          "signer": true
        },
        {
          "name": "player",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  108,
                  97,
                  121,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "authority"
              }
            ]
          }
        },
        {
          "name": "sps",
          "writable": true
        }
      ],
      "args": [
        {
          "name": "goodsSize",
          "type": {
            "defined": {
              "name": "goodsSize"
            }
          }
        }
      ]
    },
    {
      "name": "hireSecurity",
      "docs": [
        "* Hire Security allows users to spend CREDz to buy security forces"
      ],
      "discriminator": [
        155,
        205,
        122,
        190,
        242,
        188,
        24,
        108
      ],
      "accounts": [
        {
          "name": "server",
          "signer": true,
          "address": "A2UG3TvnBLjVb2uzz19igwfBN42soLXYHgQZe1TKFsV8"
        },
        {
          "name": "sps",
          "writable": true
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "incorporate",
      "docs": [
        "* Registers a SPS PDA that tracks how many Security Forces, CREDz, and Battle Points the SPS has and discord id (or user id) of the owner.\n     * Can only be called by the server because it's a discord proxy (owner is a discord user not a private key)"
      ],
      "discriminator": [
        16,
        157,
        72,
        7,
        168,
        238,
        158,
        27
      ],
      "accounts": [
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        },
        {
          "name": "server",
          "writable": true,
          "signer": true,
          "address": "A2UG3TvnBLjVb2uzz19igwfBN42soLXYHgQZe1TKFsV8"
        },
        {
          "name": "sps",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  112,
                  115
                ]
              },
              {
                "kind": "arg",
                "path": "discordId"
              }
            ]
          }
        }
      ],
      "args": [
        {
          "name": "discordId",
          "type": "string"
        }
      ]
    },
    {
      "name": "raid",
      "docs": [
        "* The server raids SPSs every so often with a random number of goblins. It takes 1 security force to defeat each goblin, If goblins deplete all security forces, the SPS is destroyed\n     * SPS gets a battle point for every goblin they defeat"
      ],
      "discriminator": [
        232,
        28,
        141,
        48,
        169,
        113,
        202,
        21
      ],
      "accounts": [
        {
          "name": "server",
          "signer": true,
          "address": "A2UG3TvnBLjVb2uzz19igwfBN42soLXYHgQZe1TKFsV8"
        },
        {
          "name": "sps",
          "writable": true
        }
      ],
      "args": [
        {
          "name": "goblins",
          "type": "u64"
        }
      ]
    },
    {
      "name": "resetPlayerTimer",
      "discriminator": [
        168,
        0,
        40,
        49,
        90,
        7,
        131,
        167
      ],
      "accounts": [
        {
          "name": "server",
          "signer": true,
          "address": "A2UG3TvnBLjVb2uzz19igwfBN42soLXYHgQZe1TKFsV8"
        },
        {
          "name": "player",
          "writable": true
        }
      ],
      "args": []
    },
    {
      "name": "reviveSps",
      "discriminator": [
        221,
        3,
        29,
        233,
        54,
        183,
        205,
        29
      ],
      "accounts": [
        {
          "name": "server",
          "signer": true,
          "address": "A2UG3TvnBLjVb2uzz19igwfBN42soLXYHgQZe1TKFsV8"
        },
        {
          "name": "sps",
          "writable": true
        }
      ],
      "args": []
    }
  ],
  "accounts": [
    {
      "name": "player",
      "discriminator": [
        205,
        222,
        112,
        7,
        165,
        155,
        206,
        218
      ]
    },
    {
      "name": "sps",
      "discriminator": [
        112,
        165,
        162,
        145,
        68,
        197,
        19,
        96
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "purchaseCooldown",
      "msg": "Player still in cooldown to buy more goods"
    },
    {
      "code": 6001,
      "name": "insufficentCredz",
      "msg": "Insufficent CREDz"
    }
  ],
  "types": [
    {
      "name": "goodsSize",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "small"
          },
          {
            "name": "medium"
          },
          {
            "name": "large"
          }
        ]
      }
    },
    {
      "name": "player",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "owner",
            "type": "pubkey"
          },
          {
            "name": "goodsBought",
            "type": "u64"
          },
          {
            "name": "nextPurchaseSlot",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "sps",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "ownerDiscordId",
            "type": "string"
          },
          {
            "name": "battlePoints",
            "type": "u64"
          },
          {
            "name": "credz",
            "type": "u64"
          },
          {
            "name": "securityForces",
            "type": "u64"
          },
          {
            "name": "isDead",
            "type": "bool"
          }
        ]
      }
    }
  ]
};
