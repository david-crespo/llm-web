// Captured wire payloads from GPT-6.1 Sol (Responses API), Claude Opus 5.5
// (Beta Messages API), and Gemini 4 Carbon (Interactions API) for:
// "Who won the 2026 Nobel Prizes in Physics and Chemistry, and for what work?
// Keep it to two concise paragraphs."
// Encrypted/signature blobs and extra uncited search hits are trimmed for size;
// text, byte/character offsets, URLs, titles, and tool structures are verbatim.

export const openaiSearchResponse = {
  id: 'resp_0f2f352a0e9a67d2006af62699e9b887d192a7ef58f0683c6c',
  object: 'response',
  created_at: 1794516634,
  status: 'completed',
  model: 'gpt-6.1-sol',
  reasoning: {
    context: 'all_turns',
    effort: 'low',
    mode: 'standard',
    summary: 'detailed',
  },
  output: [
    {
      id: 'ws_0f2f352a0e9a67d2006af6269c801887d1acb31a9a3beed330',
      type: 'web_search_call',
      status: 'completed',
      action: {
        type: 'search',
        queries: [
          'site.nobelprize.org 2026 Nobel Prize physics laureates',
          'site.nobelprize.org 2026 Nobel Prize chemistry laureates',
        ],
        query: 'site.nobelprize.org 2026 Nobel Prize physics laureates',
        // Note: action.sources omits ?utm_source=openai while url_citation includes it.
        sources: [
          {
            type: 'url',
            url: 'https://www.aps.org/about/news/2026/10/aps-winner-2026-nobel-physics',
          },
          {
            type: 'url',
            url: 'https://www.rsc.org/news/nobel-prize-for-chemistry-2026',
          },
          {
            type: 'url',
            url: 'https://www.acs.org/pressroom/newsreleases/2026/october/acs-president-comments-on-award-of-2026-nobel-prize-in-chemistry.html',
          },
          {
            type: 'url',
            url: 'https://www.kva.se/en/news/the-nobel-prize-in-chemistry-2026/',
          },
          {
            type: 'url',
            url: 'https://www.lemonde.fr/en/science/article/2026/10/07/french-scientist-henri-kagan-wins-long-awaited-nobel-prize-in-chemistry_6758364_10.html',
          },
        ],
      },
    },
    {
      id: 'msg_0f2f352a0e9a67d2006af626a067ac87d196984ee307383409',
      type: 'message',
      status: 'completed',
      role: 'assistant',
      phase: 'final_answer',
      content: [
        {
          type: 'output_text',
          annotations: [
            {
              type: 'url_citation',
              start_index: 289,
              end_index: 388,
              title:
                'American Physical Society congratulates the winner of the 2026 Nobel Prize in Physics | American Physical Society',
              url: 'https://www.aps.org/about/news/2026/10/aps-winner-2026-nobel-physics?utm_source=openai',
            },
            {
              type: 'url_citation',
              start_index: 726,
              end_index: 882,
              title: 'ACS president comments on award of 2026 Nobel Prize in Chemistry',
              url: 'https://www.acs.org/pressroom/newsreleases/2026/october/acs-president-comments-on-award-of-2026-nobel-prize-in-chemistry.html?utm_source=openai',
            },
          ],
          logprobs: [],
          text: '**Physics:** Francis Halzen won the 2026 Nobel Prize in Physics for his decisive contributions to the IceCube Neutrino Observatory and the discovery of high-energy neutrinos of astrophysical origin—work that opened a new way to study the universe using particles arriving from deep space. ([aps.org](https://www.aps.org/about/news/2026/10/aps-winner-2026-nobel-physics?utm_source=openai))\n\n**Chemistry:** Henri B. Kagan and Kenso Soai shared the 2026 Nobel Prize in Chemistry for discovering nonlinear effects and autocatalysis in asymmetric organic synthesis. Their work showed how chemical reactions can preferentially produce—and amplify—one molecular “handedness,” with important applications in pharmaceutical synthesis. ([acs.org](https://www.acs.org/pressroom/newsreleases/2026/october/acs-president-comments-on-award-of-2026-nobel-prize-in-chemistry.html?utm_source=openai))',
        },
      ],
    },
  ],
  output_text:
    '**Physics:** Francis Halzen won the 2026 Nobel Prize in Physics for his decisive contributions to the IceCube Neutrino Observatory and the discovery of high-energy neutrinos of astrophysical origin—work that opened a new way to study the universe using particles arriving from deep space. ([aps.org](https://www.aps.org/about/news/2026/10/aps-winner-2026-nobel-physics?utm_source=openai))\n\n**Chemistry:** Henri B. Kagan and Kenso Soai shared the 2026 Nobel Prize in Chemistry for discovering nonlinear effects and autocatalysis in asymmetric organic synthesis. Their work showed how chemical reactions can preferentially produce—and amplify—one molecular “handedness,” with important applications in pharmaceutical synthesis. ([acs.org](https://www.acs.org/pressroom/newsreleases/2026/october/acs-president-comments-on-award-of-2026-nobel-prize-in-chemistry.html?utm_source=openai))',
  usage: {
    input_tokens: 13097,
    input_tokens_details: { cache_write_tokens: 4486, cached_tokens: 0 },
    output_tokens: 209,
    output_tokens_details: { reasoning_tokens: 54 },
    total_tokens: 13306,
  },
}

export const anthropicSearchResponse = {
  model: 'claude-opus-5-5',
  id: 'msg_011CgyhJQ1nrqTZMVVs12ZMZ',
  type: 'message',
  role: 'assistant',
  content: [
    {
      type: 'server_tool_use',
      id: 'srvtoolu_01WMjkQdKgwoChgnTAiB9Cev',
      name: 'web_search',
      input: {
        query: '2026 Nobel Prize Physics Chemistry winners',
      },
    },
    {
      type: 'web_search_tool_result',
      tool_use_id: 'srvtoolu_01WMjkQdKgwoChgnTAiB9Cev',
      caller: { type: 'direct' },
      content: [
        {
          type: 'web_search_result',
          title: '2026 Nobel Prize winners',
          url: 'https://www.britannica.com/topic/2026-Nobel-Prize-winners',
          encrypted_content: 'ErgNCioIFRgCIiQxZGMzZTM2OS01Yzhi...',
          page_age: '30 days ago',
        },
        {
          type: 'web_search_result',
          title: 'All Nobel Prizes 2026 - NobelPrize.org',
          url: 'https://www.nobelprize.org/all-nobel-prizes-2026/',
          encrypted_content: 'EpsNCioIFRgCIiQxZGMzZTM2OS01Yzhi...',
          page_age: '30 days ago',
        },
        {
          type: 'web_search_result',
          title: 'Nobel Prize in Physics',
          url: 'https://en.wikipedia.org/wiki/Nobel_Prize_in_Physics',
          encrypted_content: 'EtUNCioIFRgCIiQxZGMzZTM2OS01Yzhi...',
          page_age: null,
        },
        {
          type: 'web_search_result',
          title: 'Nobel Prize in Chemistry',
          url: 'https://en.wikipedia.org/wiki/Nobel_Prize_in_Chemistry',
          encrypted_content: 'EtsNCioIFRgCIiQxZGMzZTM2OS01Yzhi...',
          page_age: null,
        },
      ],
    },
    {
      type: 'text',
      text: '**Physics:** ',
    },
    {
      type: 'text',
      text: 'The 2026 Nobel Prize for Physics was awarded to American physicist Francis Halzen by the Royal Swedish Academy of Sciences on October 6, 2026.',
      citations: [
        {
          type: 'web_search_result_location',
          cited_text:
            '(more)\n\nThe 2026 Nobel Prize for Physics was awarded to American physicist Francis Halzen by the Royal Swedish Academy of Sciences on October 6, 2026....',
          url: 'https://www.britannica.com/topic/2026-Nobel-Prize-winners',
          title: '2026 Nobel Prize winners',
          encrypted_index: 'Eo8BCioIFRgCIiQxZGMz...',
        },
      ],
    },
    {
      type: 'text',
      text: ' He won it ',
    },
    {
      type: 'text',
      text: '"for decisive contributions to the IceCube Neutrino Observatory and the discovery of high-energy neutrinos of astrophysical origin"',
      citations: [
        {
          type: 'web_search_result_location',
          cited_text:
            '# Nobel Prize\n\n# NOBEL PRIZES 2026\n\n## Nobel Prize in Physics 2026\n\n### Francis Halzen\n\n“for decisive contributions to the IceCube Neutrino Observator...',
          url: 'https://www.nobelprize.org/all-nobel-prizes-2026/',
          title: 'All Nobel Prizes 2026 - NobelPrize.org',
          encrypted_index: 'Eo8BCioIFRgCIiQxZGMz...',
        },
      ],
    },
    {
      type: 'text',
      text: '.\n\n**Chemistry:** ',
    },
    {
      type: 'text',
      text: 'The 2026 Nobel Prize for Chemistry was awarded to French chemist Henri B. Kagan and Japanese chemist Kenso Soai by the Royal Swedish Academy of Sciences on October 7, 2026.',
      citations: [
        {
          type: 'web_search_result_location',
          cited_text:
            'The 2026 Nobel Prize for Chemistry was awarded to French chemist Henri B. Kagan and Japanese chemist Kenso Soai by the Royal Swedish Academy of Scienc...',
          url: 'https://www.britannica.com/topic/2026-Nobel-Prize-winners',
          title: '2026 Nobel Prize winners',
          encrypted_index: 'Eo8BCioIFRgCIiQxZGMz...',
        },
      ],
    },
    {
      type: 'text',
      text: ' ',
    },
    {
      type: 'text',
      text: 'They received the prize "for the discovery of non-linear effects and autocatalysis in asymmetric organic synthesis."',
      citations: [
        {
          type: 'web_search_result_location',
          cited_text:
            'They received the prize “for the discovery of non-linear effects and autocatalysis in asymmetric organic synthesis.”',
          url: 'https://www.britannica.com/topic/2026-Nobel-Prize-winners',
          title: '2026 Nobel Prize winners',
          encrypted_index: 'Eo8BCioIFRgCIiQxZGMz...',
        },
      ],
    },
    {
      type: 'text',
      text: ' Their work helps explain a long-standing puzzle: why ',
    },
    {
      type: 'text',
      text: 'living organisms only contain one of these mirror images',
      citations: [
        {
          type: 'web_search_result_location',
          cited_text: 'However, living organisms only contain one of these mirror images. ',
          url: 'https://www.nobelprize.org/all-nobel-prizes-2026/',
          title: 'All Nobel Prizes 2026 - NobelPrize.org',
          encrypted_index: 'Eo8BCioIFRgCIiQxZGMz...',
        },
      ],
    },
    {
      type: 'text',
      text: ' of molecules like amino acids.',
    },
  ],
  stop_reason: 'end_turn',
  stop_sequence: null,
  usage: {
    input_tokens: 16482,
    cache_creation_input_tokens: 0,
    cache_read_input_tokens: 0,
    output_tokens: 444,
    server_tool_use: {
      web_search_requests: 1,
      web_fetch_requests: 0,
    },
  },
}

export const googleSearchResponse = {
  id: 'v1_ChdtU2IyYXY3cE80Q1JfUFVQaE1DRDRBVRIXbVNiMmF2N3BPNENSX1BVUGhNQ0Q0QVU',
  object: 'interaction',
  model: 'gemini-4-carbon',
  status: 'completed',
  usage: {
    total_tokens: 689,
    total_input_tokens: 376,
    total_cached_tokens: 0,
    total_output_tokens: 313,
    grounding_tool_count: [{ type: 'google_search', count: 2 }],
  },
  steps: [
    {
      type: 'user_input',
      content: [
        {
          type: 'text',
          text: 'Who won the 2026 Nobel Prizes in Physics and Chemistry, and for what work? Keep it to two concise paragraphs.',
        },
      ],
    },
    {
      id: 'call_2145372632095759145',
      type: 'google_search_call',
      search_type: 'web_search',
      arguments: {
        queries: ['2026 Nobel Prize in Chemistry', '2026 Nobel Prize in Physics'],
      },
    },
    {
      call_id: 'call_2145372632095759145',
      type: 'google_search_result',
      result: [{ search_suggestions: '<div></div>' }],
      is_error: false,
    },
    {
      type: 'thought',
    },
    {
      type: 'model_output',
      content: [
        {
          type: 'text',
          // Contains UTF-8 multi-byte em-dash ("homochirality—how"), so UTF-8 byte
          // end_index 1100 exceeds JS UTF-16 length 1099.
          text: 'The 2026 Nobel Prize in Physics was awarded to Francis Halzen for his decisive contributions to the IceCube Neutrino Observatory and the discovery of high-energy neutrinos of astrophysical origin. Halzen pioneered the concept of transforming a cubic kilometer of South Pole glacial ice into a massive, sensor-equipped particle detector. By successfully capturing these elusive cosmic particles from distant galaxies, his work laid the foundation for an entirely new branch of neutrino astronomy.\n\nThe 2026 Nobel Prize in Chemistry was jointly awarded to Henri B. Kagan and Kenso Soai for their discovery of non-linear effects and autocatalysis in asymmetric organic synthesis. Their research solved a longstanding mystery regarding homochirality—how chemical reactions can selectively produce just one of two mirror-image molecule variants, a phenomenon ubiquitous in living organisms. Beyond shedding light on the fundamental origins of biological asymmetry, their breakthroughs have major practical applications in chemical design, particularly in manufacturing safe and effective pharmaceuticals.',
          annotations: [
            {
              start_index: 0,
              end_index: 195,
              url: 'https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHv0lXUW0oX',
              title: 'europa.eu',
              type: 'url_citation',
            },
            {
              start_index: 0,
              end_index: 195,
              url: 'https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQH6ByAZrrml',
              title: 'youtube.com',
              type: 'url_citation',
            },
            {
              start_index: 197,
              end_index: 335,
              url: 'https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQE9UKqqHRXk',
              title: 'nobelprize.org',
              type: 'url_citation',
            },
            {
              start_index: 197,
              end_index: 335,
              url: 'https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFFteycbQAv',
              title: 'nobelprize.org',
              type: 'url_citation',
            },
            {
              start_index: 337,
              end_index: 494,
              url: 'https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQFFteycbQAv',
              title: 'nobelprize.org',
              type: 'url_citation',
            },
            {
              start_index: 337,
              end_index: 494,
              url: 'https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQF2B_QtagKB',
              title: 'youtube.com',
              type: 'url_citation',
            },
            {
              start_index: 497,
              end_index: 675,
              url: 'https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQG8rPQht0zp',
              title: 'nobelprize.org',
              type: 'url_citation',
            },
            {
              start_index: 677,
              end_index: 886,
              url: 'https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGG1UEjraER',
              title: 'nobelprize.org',
              type: 'url_citation',
            },
            {
              start_index: 888,
              end_index: 1100,
              url: 'https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQGG1UEjraER',
              title: 'nobelprize.org',
              type: 'url_citation',
            },
            {
              start_index: 888,
              end_index: 1100,
              url: 'https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHDmJCoE8Gq',
              title: 'cnn.com',
              type: 'url_citation',
            },
          ],
        },
      ],
    },
  ],
}
