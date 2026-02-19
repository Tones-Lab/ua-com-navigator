# ------------------------------------------------------------------------------------------------------------- #
#
#
#
#  █████╗ ██╗   ██╗████████╗ ██████╗       ██████╗ ███████╗██████╗ ██╗      ██████╗ ██╗   ██╗███████╗██████╗
#  ██╔══██╗██║   ██║╚══██╔══╝██╔═══██╗      ██╔══██╗██╔════╝██╔══██╗██║     ██╔═══██╗╚██╗ ██╔╝██╔════╝██╔══██╗
#  ███████║██║   ██║   ██║   ██║   ██║█████╗██║  ██║█████╗  ██████╔╝██║     ██║   ██║ ╚████╔╝ █████╗  ██║  ██║
#  ██╔══██║██║   ██║   ██║   ██║   ██║╚════╝██║  ██║██╔══╝  ██╔═══╝ ██║     ██║   ██║  ╚██╔╝  ██╔══╝  ██║  ██║
#  ██║  ██║╚██████╔╝   ██║   ╚██████╔╝      ██████╔╝███████╗██║     ███████╗╚██████╔╝   ██║   ███████╗██████╔╝
#  ╚═╝  ╚═╝ ╚═════╝    ╚═╝    ╚═════╝       ╚═════╝ ╚══════╝╚═╝     ╚══════╝ ╚═════╝    ╚═╝   ╚══════╝╚═════╝
#
#
#
#  Added by         D E P L O Y M E N T
#
#    Changes via the UI get's overwritten on the next deployment.
#
# ------------------------------------------------------------------------------------------------------------- #
# 2025-11-27: Martin Aigner, Initial deployment
#
# ------------------------------------------------------------------------------------------------------------- #
our %huawei_nce_lookup_interface = (
#Pattern	             MsgGroup	                    Severity	Suppression
'CORE_MsgGroup_1'	=> {'MsgGroup' => 'PSCoreMsgGroup',     'Severity'	=> '5', 'Suppress' => 'no' },
'CORE_MsgGroup_2'	=> {'MsgGroup' => 'PSCoreMsgGroup',     'Severity'	=> '4',	'Suppress' => 'no' },
'CORE_MsgGroup_3'	=> {'MsgGroup' => 'PSCoreMsgGroup',     'Severity'	=> '3',	'Suppress' => 'yes'},
'CORE_MsgGroup_6'	=> {'MsgGroup' => 'PSCoreMsgGroup',	    'Severity'	=> '2',	'Suppress' => 'yes'},
'CORE_PS_1'			=> {'MsgGroup' => 'PSCoreBasic',        'Severity'	=> '5',	'Suppress' => 'no' },
'CORE_PS_2'			=> {'MsgGroup' => 'PSCoreBasic',        'Severity'	=> '4',	'Suppress' => 'no' },
'CORE_PS_3'			=> {'MsgGroup' => 'PSCoreBasic',        'Severity'	=> '3',	'Suppress' => 'yes'},
'CORE_PS_6'			=> {'MsgGroup' => 'PSCoreBasic',        'Severity'	=> '2',	'Suppress' => 'yes'},
'CORE_SE_1'			=> {'MsgGroup' => 'OPS-BASIC-PRODUCTS', 'Severity'	=> '5',	'Suppress' => 'no' },
'CORE_SE_2'			=> {'MsgGroup' => 'OPS-BASIC-PRODUCTS', 'Severity'	=> '4',	'Suppress' => 'no' },
'CORE_SE_3'			=> {'MsgGroup' => 'OPS-BASIC-PRODUCTS', 'Severity'	=> '3',	'Suppress' => 'yes'},
'CORE_SE_6'			=> {'MsgGroup' => 'OPS-BASIC-PRODUCTS', 'Severity'	=> '2',	'Suppress' => 'yes'},
'BSS_BCS_1'			=> {'MsgGroup' => 'B2B-BCS', 	        'Severity'	=> '5',	'Suppress' => 'no' },
'BSS_BCS_2'			=> {'MsgGroup' => 'B2B-BCS', 	        'Severity'	=> '4',	'Suppress' => 'no' },
'BSS_BCS_3'			=> {'MsgGroup' => 'B2B-BCS', 	        'Severity'	=> '3',	'Suppress' => 'yes'},
'BSS_BCS_6'			=> {'MsgGroup' => 'B2B-BCS', 	        'Severity'	=> '2',	'Suppress' => 'yes'},
'AN-TX_1'			=> {'MsgGroup' => 'OPS-AN-Transmission','Severity'	=> '5',	'Suppress' => 'no' },
'AN-TX_2'			=> {'MsgGroup' => 'OPS-AN-Transmission','Severity'	=> '4',	'Suppress' => 'no' },
'AN-TX_3'			=> {'MsgGroup' => 'OPS-AN-Transmission','Severity'	=> '3',	'Suppress' => 'yes'},
'AN-TX_6'			=> {'MsgGroup' => 'OPS-AN-Transmission','Severity'	=> '2',	'Suppress' => 'yes'},
);