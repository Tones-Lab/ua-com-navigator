use Time::HiRes qw(time);
######################################################################################################
#       _Name_  collection/event/H3A/common/lib/H3A_LibUtils.pm
######################################################################################################
# 
# Util functions
#
# Source Control:
#       1.0		2023-12-14	aignerma	<STORY>		initial version
# 		1.1		2023-12-18	aignerma	<STORY>		moved "flood control" functions from H3A_Utils.rules
#		1.2		2023-11-22	lavickm2	<no story>	reorderd function in alphabetical order
#
######################################################################################################


#######################################
#   GLOBAL VARIABLES
#######################################
our %EventJSONFields = (
                SuppressionList         => { Type => 'JSON'    , CompareDepth => 2},
                AdditionalInfo          => { Type => 'JSON'    , CompareDepth => 2},
                Details					=> { Type => 'JSON'    , CompareDepth => 4},
        );
        

######################################################################################################
# Name: LibUtil_AddDetails 
# Parameters: a reference to the Event
#             a key of detail
#             a message
# Description: Updates the Event fields Details
#              Detail is treated as JSON with {"Key": {"TIMESTAMP": "message"}} pairs.
######################################################################################################
sub LibUtil_AddDetails {
	my ($eventRef,$key, $message) = @_;
    
    my $trace = '  LibUtil_AddDetails';
	$Log->Message('DEBUG', $trace . " started...");

	use POSIX qw( strftime );
	my $t = time;
	my $timestamp = strftime "%Y-%m-%d %H:%M:%S", localtime $t;
	my $timezone = strftime " %z (%Z)", localtime $t;
	$timestamp .= sprintf ".%03d", ($t-int($t))*1000; # without rounding
	$timestamp .= $timezone; # add timezone

	if ( exists $eventRef->{EventID}) {
		$Log->Message('DEBUG', $trace . " Debug-01-002: EventID exists. ");  
		if (exists $eventRef->{Details}) {
			eval {
				$actualDetails = decode_json $eventRef->{Details};
			}; 
	
			if ($@) {
					$Log->Message('ERROR', "Could not parse original Details JSON. Field will be overwritten! Details Value: '".$eventRef->{Details}."' Received error: " . $@);
			} 
			
            # 02.09.2024: aignerma: In order to avoid additional indexes in elastic (each timestamp got treated as new field) 
            #                       The format of "logs" has been changed to an ARRAY. 
            #                       If an old format is found the following IF will change them to an ARRAY! 
            #                       The updateEvent function will fail if the old Details attribute is a ARRAY and the new a HASH!
            # 						This If can be removed once no events has a detail field with the old format.
			if (ref $actualDetails->{$key} eq 'HASH') {
            	my @tmpARRAY;
				foreach my $timestamp (sort keys %{$actualDetails->{$key}}) {
                		push @tmpARRAY, $timestamp . ": " . $actualDetails->{$key}->{$timestamp};
				}
				$actualDetails->{$key} = undef;
				push @{$actualDetails->{$key}}, @tmpARRAY;
			}
            push @{$actualDetails->{$key}}, $timestamp . ": " . $message;
            $eventRef->{Details} = encode_json($actualDetails);
		}
	} else {
		push @{$eventRef->{Details}->{$key}}, $timestamp . ": " . $message;
	}

    $Log->Message('DEBUG', $trace . "...done");
}

######################################################################################################
# Name: 		LibUtil_AddRaw2Details 
# Parameters: 	Reference to the Event
# Description:	Adds all RAW-Event-Information to Event-Details-Field
#					-) Trap-Tokens or 
#					-) Webhook-Header/Content or 
#					-) TCPServerd/Packetinfos
######################################################################################################
sub LibUtil_AddRaw2Details {
	my $eventRef = shift;

	my $trace = '  LibUtil_AddRaw2Details';
	$Log->Message('DEBUG', $trace . " started...");

	# Determin which Aggregator called the function
    if(defined($enterprise) && length($enterprise) > 0) {
    	# Trap-Aggregator
        $Log->Message('DEBUG', $trace . " TrapAggregator identified");
        
		$traplog = "Enterprise [$enterprise] : Specific [$specific] : Generic [$generic] : Varbinds ";

		# Product version
		# hard to read, all in one string.
		# while (my ($key, $value) = each(%$vars)) {
		#	if (ref($value) eq 'ARRAY') {
		#		foreach my $var (@$value) {
		#			$traplog .= "[$key => $var]";
		#		}
		#	} else {
		#		$traplog .= "[$key => $value] ";
		#	}
		# }
        # $eventRef->{Details}->{traplog} = $traplog;


		# SR #3-41362292361: JSON is no longer stored in OpenSearch
		#$eventRef->{Details}->{RAWTrap}->{Enterprise} = $enterprise;
		#$eventRef->{Details}->{RAWTrap}->{Specific} = $specific;
		#$eventRef->{Details}->{RAWTrap}->{Generic} = $generic;
		#$eventRef->{Details}->{RAWTrap}->{Agent} = $agent;
		#$eventRef->{Details}->{RAWTrap}->{Received} = $received;
		#$eventRef->{Details}->{RAWTrap}->{TrapOID} = $trapoid;
		$traplog = 'Enterprise: ' . $enterprise . ' Specific: ' . $specific . ' Generic: ' . $generic . ' Agent: ' . $agent . ' Received: ' . $received . ' TrapOID: ' . $trapoid . ' Varbinds: ';

		my $num=0;
		my $varbind_nr=1;
		foreach my $key (@varbinds) {
			my $value = $vars->{$varbinds[$num]};
			if ($num <= 1 && $value =~ /^\d+$/ ) {
				# push @{$eventRef->{Details}->{RAWTrap}->{Varbinds}}, { 'VarbindNr' => "timeticks($num)", 'OID' => $key, 'Value' => $value };
				$traplog .= "timeticks($num): " . $key . " = " . $value . " ";
			} elsif ($num <= 1 && $value eq $trapoid ) {
				# push @{$eventRef->{Details}->{RAWTrap}->{Varbinds}}, { 'VarbindNr' => "trapoid($num)", 'OID' => $key, 'Value' => $value };
				$traplog .= "trapoid($num): " . $key . " = " . $value . " ";
			}else {
				if (ref($value) eq 'ARRAY') {
					# push @{$eventRef->{Details}->{RAWTrap}->{Varbinds}}, { 'VarbindNr' => $varbind_nr, 'OID' => $key, 'Value' => @$value };
					$traplog .= "Varbind_$varbind_nr: " . $key . " = [" . join(", ", @$value) . "] ";
				} else {
					# push @{$eventRef->{Details}->{RAWTrap}->{Varbinds}}, { 'VarbindNr' => $varbind_nr, 'OID' => $key, 'Value' => $value };
					$traplog .= "Varbind_$varbind_nr: " . $key . " = " . $value . " ";
				}
				$varbind_nr++;
			}
			$num++;
		}
		$eventRef->{Details}->{TrapDetails} = $traplog;
    } elsif(defined($uri) && length($uri) > 0) {
		# Webhook-Aggregator
        $Log->Message('DEBUG', $trace . " WebHookd-Aggregator identified");
		$eventRef->{Details}->{RAW_Webhook_uri} = $uri->as_string;
		$eventRef->{Details}->{RAW_Webhook_headers} = $headers;
        $eventRef->{Details}->{RAW_Webhook_content} = $content;
        
	} elsif(%Packet) {
		# TCP-Aggregator#
		$Log->Message('DEBUG', $trace . " TCPServerd-Aggregator identified");
        $eventRef->{Details}->{TCPServerd_Host}		= Dumper($Packet->{Host});
        $eventRef->{Details}->{TCPServerd_IP}		= Dumper($Packet->{IP});
        $eventRef->{Details}->{TCPServerd_Message}	= Dumper($Packet->{Message});
        
	} 
    
	$Log->Message('DEBUG', $trace . "...done");

}

######################################################################################################
# Name: LibUtil_addSuppression 
# Parameters: a reference to the Event
#             a Name of Suppression,
#             a Key of Suppression
#             a Expire Time  (default = 0)
#             a Additional Information
#             a Created by
# Description: Updates the Event fields Suppression and SuppressionList
#              NOTE: Existing Suppressions do not get overwritten!! 
######################################################################################################
sub LibUtil_AddSuppression {
	my ($eventRef,$SuppName, $SuppKey, $ExpireTime, $AdditionalInfo, $created_by) = @_;
    
    my $trace = '  LibUtil_AddSuppression';
	$Log->Message('DEBUG', $trace . " started...");
    
    if (not exists $eventRef->{Suppression}) {
		$Log->Message('INFO', $trace . " Suppression not initialized. Default will be set.");
        $eventRef->{Suppression} = 0;
    }
    
    if (not exists $eventRef->{SuppressionList}) {
		$Log->Message('INFO', $trace . " SuppressionList not initialized. Default will be set.");
        $eventRef->{SuppressionList} = "{}";
    }

	if ( $eventRef->{Suppression}!~/0|1/ || $eventRef->{SuppressionList}!~/^{.*}/ ) {
    	$Log->Message('WARN', $trace . " Actual Suppression not valid (Suppression: '".$eventRef->{Suppression}."' SuppressionList: '".$eventRef->{SuppressionList}."'). Reset to default.");
        $eventRef->{Suppression} = 0;
        $eventRef->{SuppressionList} = "{}";
    }
        
	$Log->Message('DEBUG', $trace . " Arguments: Name='".$SuppName."', Key='".$SuppKey."', ExpireTime='".$ExpireTime."', AdditionalInfo='".$AdditionalInfo."', created_by='".$created_by."'");
    
	my $actualSuppressionList = decode_json($eventRef->{SuppressionList});

	if (exists $actualSuppressionList->{$SuppName}->{$SuppKey}) {
		$Log->Message('DEBUG', $trace . " suppression already exists. Exiting.");
	} else {

		$actualSuppressionList->{$SuppName}->{$SuppKey}->{ExpireTime} = $ExpireTime;
		$actualSuppressionList->{$SuppName}->{$SuppKey}->{AdditionalInfo} = $AdditionalInfo;
		$actualSuppressionList->{$SuppName}->{$SuppKey}->{created_at} = time();
		$actualSuppressionList->{$SuppName}->{$SuppKey}->{created_by} = $created_by;
		$actualSuppressionList->{$SuppName}->{$SuppKey}->{ExpireTime} = $ExpireTime;


		$eventRef->{'SuppressionList'} = encode_json($actualSuppressionList);
		$eventRef->{'Suppression'} = 1;
		$eventRef->{'LastComment'} = 'Event Suppressed';
        
		$Log->Message('DEBUG', $trace . " new SuppressionList: '" . $eventRef->{'SuppressionList'} . "'" );

        #write journal
        if ( exists $eventRef->{EventID}) {
            my ($ErrorFlag, $Message) = AddJournal({
                DBH       => \$EventDBH,
                EventID   => $eventRef->{EventID},
                TimeStamp => time(),
                Username  => 'admin',
                Entry     => "Suppression '$SuppName' with Key '$SuppKey' added.",
                ShardID   => $AppConfig->{'ShardID'}
            });
        }

    }
   	$Log->Message('DEBUG', $trace . " ...done");

}

######################################################################################################
# Name: LibUtil_CreateSyntheticEvent 
# Description:	The functions created an Synthetic event in the uUMS-System 
#				with the given values (via TCPServerd Aggregator)
# Parameters: 	-) %hash which contains the EventFields for the new Event
######################################################################################################
sub LibUtil_CreateSyntheticEvent {

	# Logging: Started
	my $trace = '  LibUtil_CreateSyntheticEvent';
    $Log->Message('DEBUG', $trace . ' started...');
    
    
	# Get Parameter
    # my $Param_Event = shift;
    my ($Param_Event) = @_;

	# Variable Definition
    my $ReturnCode;
    my $ReturnMessages;
    
    # Get config for Internal WebHook aggregator
    my $webhook_host1 = $envRef->{'uums-internal-webhookd-hostname1'};
    my $webhook_host2 = $envRef->{'uums-internal-webhookd-hostname2'};
	my $webhook_port = $envRef->{'uums-internal-webhookd-port'};
	my $webhook_uri = $envRef->{'uums-internal-webhookd-uri-syntheticevent'};
    # Create a url for webhook request
	my $webhook_url1 = "https://" . $webhook_host1 . ":" . $webhook_port . $webhook_uri;
    my $webhook_url2 = "https://" . $webhook_host2 . ":" . $webhook_port . $webhook_uri;


    $Log->Message('DEBUG', $trace . ' \%Param_Event: ' . %Param_Event);
    
    # Debugging Logging for AppConfig (to determin which rules, cape, job called this function
    $Log->Message('TRACE', $trace . ' Logging of AppConfig');
	foreach my $key(keys %AppConfig){
		$Log->Message('TRACE', "Key: $key = " . $AppConfig->{$key});
	}
    
    # Debugging Logging for received Parameters
    $Log->Message('DEBUG', $trace . ' Logging RECEIVED Values.');
	foreach my $key (keys %$Param_Event) { 
    	$Log->Message('TRACE', $trace . " received \$Param_Event->{$key}='" . $Param_Event->{$key} . "'");
	}
    

	#-----------------------------------------------------------------------------------------
    # Adding all given Parameters to NewEvent
    #-----------------------------------------------------------------------------------------
    my %NewEvent = (
		AppConfig_Name		=> $AppConfig->{Name},					# Needed to determin where the Synthetic Event was generated
        AppConfig_BaseRules	=> $AppConfig->{BaseRules},				# Needed to determin where the Synthetic Event was generated
        Source				=> $trace,								# Needed to validate in the Aggregator that this event is valid
        
		#All Event.Events-Field
		#Ack					=> $Param_Event->{'Ack'},					# Only set by Users
		#AckBy					=> $Param_Event->{'AckBy'},					# Only set by Users
		#AckTime				=> $Param_Event->{'AckTime'},				# Only set by Users
		#Action					=> $Param_Event->{'Action'},				# Defined in the Insert/Seftfield SQL
		#Actor					=> $Param_Event->{'Actor'},					# Defined in the Insert/Seftfield SQL
		AdditionalInfo			=> $Param_Event->{'AdditionalInfo'} ? defined($Param_Event->{'AdditionalInfo'}) : "{}",
		AlarmCategorization1	=> $Param_Event->{'AlarmCategorization1'},
		AlarmCategorization2	=> $Param_Event->{'AlarmCategorization2'},
		AlarmCode				=> $Param_Event->{'AlarmCode'},
		CAPEFlag				=> $Param_Event->{'CAPEFlag'},
		#CMDBCIEnvironment		=> $Param_Event->{'CMDBCIEnvironment'},		# Only Set by Remedy Enrichment
		CMDBCIID				=> $Param_Event->{'CMDBCIID'},
		#CMDBCIStatus			=> $Param_Event->{'CMDBCIStatus'},			# Only Set by Remedy Enrichment
		CMDBServiceID			=> $Param_Event->{'CMDBServiceID'},
		ClearOrderKey			=> $Param_Event->{'ClearOrderKey'},
		#ClearTime				=> $Param_Event->{'ClearTime'},				# Only Set by Clearing (CAPE/Mechanization)
		Company					=> $Param_Event->{'Company'},
		#Count					=> $Param_Event->{'Count'},					# Not Allowed to be set by Event-Creation, handled by Insert/Deduplication SQL
		Customer				=> $Param_Event->{'Customer'},
		Department				=> $Param_Event->{'Department'},
		Details					=> $Param_Event->{'Details'},
		DeviceType				=> $Param_Event->{'DeviceType'},
		#Duration				=> $Param_Event->{'Duration'},				# Set by the uUMS System
		EMSAlarmID				=> $Param_Event->{'EMSAlarmID'},
		#EMSHost				=> $Param_Event->{'EMSHost'},				# Defines the source of the Message (E.g. avl6073d)
		EMSHostGroup			=> $Param_Event->{'EMSHostGroup'},		
		#EMSIPAddress			=> $Param_Event->{'EMSIPAddress'},			# Defines the source of the Message (E.g. avl6073d)
		EMSName					=> $Param_Event->{'EMSName'},
		EMSService				=> $Param_Event->{'EMSService'},
		#EscalationFlag			=> $Param_Event->{'EscalationFlag'},		# not used in uUMS
		EventCategory			=> $Param_Event->{'EventCategory'},
		#EventID				=> $Param_Event->{'EventID'},				# Not Allowed to be set by Event-Creation, handled by DB
		EventKey				=> $Param_Event->{'EventKey'},
		EventType				=> $Param_Event->{'EventType'},
		ExpireTime				=> $Param_Event->{'ExpireTime'},
		#FirstReported			=> $Param_Event->{'FirstReported'},			# Handled by Insert/Deduplication SQL
		GeoLocation				=> $Param_Event->{'GeoLocation'},
		GeoPath					=> $Param_Event->{'GeoPath'},
		HelpKey					=> $Param_Event->{'HelpKey'},
		IPAddress				=> $Param_Event->{'IPAddress'},
		#LastChanged			=> $Param_Event->{'LastChanged'},			# Not Allowed to be set by Event-Creation, handled by Insert/Deduplication SQL
		#LastComment			=> $Param_Event->{'LastComment'},			# Handled by the uUMS System
		#LastReported			=> $Param_Event->{'LastReported'},			# Handled by Insert/Deduplication SQL
		Location				=> $Param_Event->{'Location'},
		#Method					=> $Param_Event->{'Method'},				# Is defined by the destinatino Aggregator Name (e.g. H3A_A_WebHook_Generic_Internal)
		MsgGroup				=> $Param_Event->{'MsgGroup'},
		NECard					=> $Param_Event->{'NECard'},
		NECluster				=> $Param_Event->{'NECluster'},
		NEFirstReported			=> $Param_Event->{'NEFirstReported'},
		NELastReported			=> $Param_Event->{'NELastReported'},
		NEMilestone				=> $Param_Event->{'NEMilestone'},
		NEMilestoneDescription	=> $Param_Event->{'NEMilestoneDescription'},
		NEName					=> $Param_Event->{'NEName'},
		NEPort					=> $Param_Event->{'NEPort'},
		NERNC					=> $Param_Event->{'NERNC'},
		NERegion				=> $Param_Event->{'NERegion'},
		NEShelf					=> $Param_Event->{'NEShelf'},
		NESlot					=> $Param_Event->{'NESlot'},
		NETHS					=> $Param_Event->{'NETHS'},
		Node					=> $Param_Event->{'Node'},
		NodeAlias				=> $Param_Event->{'NodeAlias'},
		OnCall					=> $Param_Event->{'OnCall'},
		#OrigSeverity			=> $Param_Event->{'OrigSeverity'},			# Handled by Insert/Deduplication SQL
		OwnedTime				=> $Param_Event->{'OwnedTime'},				# Only set by Users
		OwnerName				=> $Param_Event->{'OwnerName'},				# Only set by Users
		ResendInterval			=> $Param_Event->{'ResendInterval'},
		#RootCauseFlag			=> $Param_Event->{'RootCauseFlag'},			# Not used by Aggregators
		#RootCauseID			=> $Param_Event->{'RootCauseID'},			# Not used by Aggregators
		#Score					=> $Param_Event->{'Score'},					# Not Used by the uUMS System
		Service					=> $Param_Event->{'Service'},
		ServiceImpact			=> $Param_Event->{'ServiceImpact'},
		Severity				=> $Param_Event->{'Severity'},
		SubDeviceType			=> $Param_Event->{'SubDeviceType'},
		SubMethod				=> $Param_Event->{'SubMethod'},
		SubNode					=> $Param_Event->{'SubNode'},
		Summary					=> $Param_Event->{'Summary'},
		Suppression				=> $Param_Event->{'Suppression'},
		SuppressionList			=> $Param_Event->{'SuppressionList'},
		Technology				=> $Param_Event->{'Technology'},
		TicketActionType		=> $Param_Event->{'TicketActionType'},
		TicketAssignedGroup		=> $Param_Event->{'TicketAssignedGroup'},
		TicketCategoryLevel1	=> $Param_Event->{'TicketCategoryLevel1'},
		TicketCategoryLevel2	=> $Param_Event->{'TicketCategoryLevel2'},
		TicketCategoryLevel3	=> $Param_Event->{'TicketCategoryLevel3'},
		TicketCustomerService	=> $Param_Event->{'TicketCustomerService'}? defined($Param_Event->{'TicketCustomerService'}) : "{}",,
		#TicketEntryID			=> $Param_Event->{'TicketEntryID'},				# Not Allowed to be set by Event-Creation, Only handled by Remedy
		TicketFlag				=> $Param_Event->{'TicketFlag'},
		TicketFollowUpTime		=> $Param_Event->{'TicketFollowUpTime'},
		TicketID				=> $Param_Event->{'TicketID'},
		TicketNotes				=> $Param_Event->{'TicketNotes'},
		#TicketRelatedIncNr		=> $Param_Event->{'TicketRelatedIncNr'},		# Not Allowed to be set by Event-Creation, Only handled by Remedy
		#TicketRelationType		=> $Param_Event->{'TicketRelationType'},		# Not Allowed to be set by Event-Creation, Only handled by Remedy
		TicketSeverity			=> $Param_Event->{'TicketSeverity'},
		#TicketStatus			=> $Param_Event->{'TicketStatus'},				# Only handled by Remedy
		#TicketStatusReason		=> $Param_Event->{'TicketStatusReason'},		# Only handled by Remedy
		TicketSubmitTime		=> $Param_Event->{'TicketSubmitTime'},
		TicketSubmitter			=> $Param_Event->{'TicketSubmitter'},
		#TicketSystem			=> $Param_Event->{'TicketSystem'},				# Definded by MsgGroup Enrichment
		TicketUrgency			=> $Param_Event->{'TicketUrgency'},
		#TicketVendor			=> $Param_Event->{'TicketVendor'},				# Only handled by Remedy
		#TicketVendorTicketID	=> $Param_Event->{'TicketVendorTicketID'},		# Only handled by Remedy
		#VisibleTime			=> $Param_Event->{'VisibleTime'},				# Defined by the uUMS System
		ZoneID					=> $Param_Event->{'ZoneID'},
    );
    
    
	#-----------------------------------------------------------------------------------------
    # Sending Event to Aggregator
    #-----------------------------------------------------------------------------------------
    # Debugging Logging: which Event Fileds are sent towards aggregator
	foreach my $key ( sort(keys %NewEvent) ) { 
		$Log->Message('DEBUG', $trace . " sending \$NewEvent{$key}='" . $NewEvent{$key} . "'");
	}

	# Format event_values as JSON
	my $final_msg= encode_json(\%NewEvent);
    $Log->Message('DEBUG', $trace . "\$final_msg='" . $final_msg . "'");

	# Create a webhook useragent
	my $ua = LWP::UserAgent->new(timeout => 30);
	$ua->agent("Assure1 CURL ClientCertificate");

	# SSL certificates that will be used for webhook request
    $Log->Message('DEBUG', $trace . "\$Config->{'BaseDir'}='" . $Config->{'BaseDir'} . "'");
	my $sslfile =  $Config->{'BaseDir'} . '/etc/ssl/BundleCA.crt';
	my $sslkeyfile = $Config->{'BaseDir'} . '/etc/ssl/User-assure1.key';
	my $sslcertfile = $Config->{'BaseDir'} . '/etc/ssl/User-assure1.crt';

	# Set the SSL certificates in useragent
	$ua->ssl_opts(SSL_ca_file => $sslfile);
	$ua->ssl_opts(SSL_key_file => $sslkeyfile);
	$ua->ssl_opts(SSL_cert_file => $sslcertfile);

	# Send the webhook request
    my $response = $ua->post($webhook_url1, 'Content-Type' => 'application/json', 'Content' => $final_msg);
	my $ResponseCode = $response->code;
    my $ResponseMessage = $response->message;
    $Log->Message('DEBUG', $trace . "\$ResponseCode='" . $ResponseCode . "',\$ResponseMessage='" . $ResponseMessage . "'");
    
    if($ResponseCode != 200) {
    	$Log->Message('ERROR', $trace . " Webhook Post failed 1st host: $webhook_url1 (strResponseCode: $strResponseCode). Trying 2nd host.");
        $response = $ua->post($webhook_url2, 'Content-Type' => 'application/json', 'Content' => $final_msg);
		$ResponseCode = $response->code;
        $ResponseMessage = $response->message;
        $Log->Message('DEBUG', $trace . "\$ResponseCode='" . $ResponseCode . "',\$ResponseMessage='" . $ResponseMessage . "'");
        
        if($ResponseCode != 200) {
        	$ReturnCode = 1;
        	$Log->Message('ERROR', $trace . " Webhook Post failed 2nd host: $webhook_url2 (ResponseCode: $ResponseCode). Trying 2nd host.");
        } else {
        	$ReturnCode = 0;
        	$Log->Message('INFO', $trace . " Webhook Post Sucessful 2nd host: $webhook_url2 (ResponseCode: $ResponseCode).");
        }
	} else {
    	$ReturnCode = 0;
    	$Log->Message('INFO', $trace . " Webhook Post Sucessful 1st host: $webhook_url1 (ResponseCode: $ResponseCode).");
    }
        
	$ReturnMessage = $ResponseMessage;

	return($ReturnCode, $ReturnMessage);
}

######################################################################################################
# Name: 		LibUtil_Discard 
# Parameters: 	-) a reference to the Event
#             	-) The Reason why the Event was discarded (INC, WO, Jira-Item)
# Description: This function just logs INFO message and discards the event
#              (default discard is only visible in debug mode which isn't going to be used in prod)
######################################################################################################
sub LibUtil_Discard {
	my $eventRef = shift;
    my $discard_reason = shift;
    my $trace = 'LibUtil_Discard';

	if($discard_reason) {
		$Log->Message('INFO', $trace . " Event '" . $eventRef->{'Node'} . "/" . $eventRef->{'HelpKey'} . "/" . $eventRef->{'Summary'} . "' Discarded based on: '" . $discard_reason . "'");
	} else {
		$Log->Message('INFO', $trace . " Event '" . $eventRef->{'Node'} . "/" . $eventRef->{'HelpKey'} . "/" . $eventRef->{'Summary'} . "' Discarded WITHOUT reason.");
	}

	$discard_flag = 1;
	$Log->Message('DEBUG', $trace . " ...done");
}

######################################################################################################
# Name: LibUtil_GetAdditionalInfo 
# Parameters: 	a reference to the Event
#             	a Name of AdditionalInfo
# Returnvalues: a Value of the given name or undef
# Description: Returns the value of the given AdditionalInfo name. 
#              AdditionalInfo is treated as JSON with {"Name": "Value"} pairs.
######################################################################################################
sub LibUtil_GetAdditionalInfo {
	my ($eventRef,$name) = @_;
    
    my $trace = '  LibUtil_GetAdditionalInfo';
	$Log->Message('DEBUG', $trace . " started...");

	my $actualAdditionalInfo;
    
	$Log->Message('DEBUG', $trace . " Arguments: Name='".$name."'");
	if (exists $eventRef->{AdditionalInfo}) {
		# AddtionalInfo must be a JSON! we can't use eval on aggregator level. In order to minimize the risk the following check is introduced.
		# Check if AdditionalInfo is a possible JSON
		if ( $eventRef->{AdditionalInfo} =~ /^\{.*\}$/ ) {
			$actualAdditionalInfo = decode_json($eventRef->{AdditionalInfo});
		} else {
			$Log->Message('WARN', "Could not parse original AdditionalInfo JSON. (Value='".$eventRef->{AdditionalInfo}."'). Field will be overwritten! Check default value of AdditionalInfo field!!");
			$actualAdditionalInfo = decode_json ("{}");
		}; 
	}
    
	if (exists $actualAdditionalInfo->{$name}) {
   	    $Log->Message('DEBUG', $trace . " ...done");
		return $actualAdditionalInfo->{$name};
	} else {
   	    $Log->Message('DEBUG', $trace . " ...done (key not found)");
		return undef;
	}
}

######################################################################################################
# Name: LibUtil_GetFormatedAdditionalInfo 
# Parameters: 	a reference to the Event
#             	a Name of AdditionalInfo
# Returnvalues: a Value of the given name or undef
# Description: Returns the value of the given AdditionalInfo name. 
#              AdditionalInfo is treated as JSON with {"Name": "Value"} pairs.
######################################################################################################
sub LibUtil_GetFormatedAdditionalInfo {
	my ($eventRef) = @_;
    my $formatedString='';
    my $trace = '  LibUtil_GetFormatedAdditionalInfo';
	$Log->Message('DEBUG', $trace . " started...");

	my $actualAdditionalInfo;
    
	$Log->Message('DEBUG', $trace . " Arguments: Name='".$name."'");
	if (exists $eventRef->{AdditionalInfo}) {
		# AddtionalInfo must be a JSON! we can't use eval on aggregator level. In order to minimize the risk the following check is introduced.
		# Check if AdditionalInfo is a possible JSON
		if ( $eventRef->{AdditionalInfo} =~ /^\{.*\}$/ ) {
			$actualAdditionalInfo = decode_json($eventRef->{AdditionalInfo});
        } elsif ( $eventRef->{AdditionalInfo} eq '' ) {
        	return $formatedString;
		} else {
			$Log->Message('WARN', "Could not parse original AdditionalInfo JSON. (Value='".$eventRef->{AdditionalInfo}."'). Field will be overwritten! Check default value of AdditionalInfo field!!");
			$actualAdditionalInfo = decode_json ("{}");
		}; 
	}

    
    foreach my $name (sort { $a <=> $b } keys %$actualAdditionalInfo) {
        $formatedString.=$name . ': ' . $actualAdditionalInfo->{$name} . chr(13);   # chr(13) is a carriage return 
    }
    
	return $formatedString;
}


######################################################################################################
# Name: LibUtil_GetEnvValuesGlobal
# Description: Retrieve Environment
# Parameters: ....
#				.....
######################################################################################################
sub LibUtil_GetEnvValuesGlobal {

	my $trace = 'LibUtil_GetEnvValuesGlobal';
	my $table = 'DCI.t_environmental' ;
	my $host = hostname();
	my $filter = "thishost = '$host'" ;
	my @results = () ;
    my @columns = qw(*);
    
    $Log->Message('DEBUG', $trace . ' started.');
    
    my $CustomDBH = DBConnect($Config, 'Event', {AutoCommit => 1, ShardID => $ShardID});

	my ($cnt,$msg) = LibMySQL_GetByFilter_v2 ($CustomDBH, $table, $filter, \@results, \@columns, undef) ;

	$CustomDBH->disconnect;
    my %env = () ;
	foreach my $nvp (@results) {
		$env{$nvp->{name}} = $nvp->{value} ;
	}

	# log all available environment nvp
	#foreach my $envKey (sort keys %env) {
	#	$Log->Message('INFO', $trace . ' ENV for ' . $host . ': ' . $envKey . ': ' . $env{$envKey});
	#}

	return (\%env) ;
}

sub LibUtil_GetEnvironmentalNVPs {
	my ($filtercondition) = @_;
    
	my $trace = 'LibUtil_GetEnvironmentalNVPs';
	my $table = 'DCI.t_environmental' ;
    my @results = () ;
    my @columns = qw(name value);
    my $filter = '';

	$Log->Message('DEBUG', $trace . ' started.');
	$Log->Message('DEBUG', $trace . ' ref(\$filtercondition) "' . ref($filtercondition) . '" detected.');

	if(ref($filtercondition) eq 'ARRAY') {
    	# ARRAY wass passed as parameter
		$filter = 'name regexp "^(' . join('|',@$filtercondition) . ').*"';
	} elsif(!defined($filtercondition)) {
    	die($trace . " not allowed without any parameter!");
    } else {
    	# Parameter was a string
        $filter = 'name regexp "^' . $filtercondition . '.*"';
	}
	
    
    
    #$Log->Message('INFO', $trace . ' filter: ' . $filter);
    $ShardID //= $AppConfig->{'ShardID'};
    if (not defined $ShardID) {
        $ShardID=1;
        $Log->Message('WARN', $trace . ' ShardID is not defined in Service properties! Using hardcoded ShardID 1!');
    }
        
    my $CustomDBH = DBConnect($Config, 'Event', {AutoCommit => 1, ShardID => $ShardID});
 	$Log->Message('DEBUG', $trace . ' Querying table with filter: ' . $filter);
	my ($cnt,$msg) = LibMySQL_GetByFilter_v2($CustomDBH, $table, $filter, \@results, \@columns, undef) ;

	$CustomDBH->disconnect;
    my %env = () ;
	foreach my $nvp (@results) {
		$env{$nvp->{name}} = $nvp->{value} ;
	}

	# log all available environment nvp
	#foreach my $envKey (sort keys %env) {
	#	$Log->Message('INFO', $trace . ' ENV for ' . $host . ': ' . $envKey . ': ' . $env{$envKey});
	#}
	$Log->Message('DEBUG', $trace . ' ... done');
	return (\%env) ;
}

######################################################################################################
# Name: ReadMaintenanceWindows
# Description: Fills the MW hash after the last read checktime to populate the updated list of MW
#
######################################################################################################
our $last_read_windows;
sub LibUtil_ReadMaintenanceWindows() {
	my $WindowSQL = "
		SELECT D.CustomName,
			INET_NTOA(D.IPAddress) AS IPv4,
			INET6_NTOA(D.IPv6Address) AS IPv6,
			D.DNSName AS DNS,
			DSI.SysName,
			W.StartTime,
			W.StopTime
		FROM DeviceWindows_Devices AS DWD
		LEFT JOIN Devices AS D
			ON D.DeviceID = DWD.DeviceID
		LEFT JOIN DeviceWindows AS W
			ON DWD.WindowID = W.WindowID
		LEFT JOIN DeviceSystemInfo AS DSI
			ON D.DeviceID = DSI.DeviceID
		";
      my $Config = Assure1::Config->new({
    configPath => '/appl/oss/assure1/etc/Assure1.conf'});

        my $url = '/api/device/Devices';
        my $client = Assure1::API->new(
        {
            url => $url,
            sslClientCert => 1
        });


    my $url = '/api/device/Devices';
        my $client = Assure1::API->new(
        {
            url => $url,
            sslClientCert => 1
        });

	$DBH = DBConnect($Config, 'Assure1', {AutoCommit => 1});
	my $Count = 0;
	my $SelectStatement = $DBH->prepare($WindowSQL);
	$SelectStatement->execute();
	$WindowHash = ();
	while (my $ref = $SelectStatement->fetchrow_hashref()) {
		$WindowHash->{$ref->{DNS}}->{StartTime} = $ref->{StartTime};
		$WindowHash->{$ref->{DNS}}->{StopTime} = $ref->{StopTime};
		$Count++;
	}
	#$WindowHash->{''} = 0;
	$SelectStatement->finish();
	$DBH->disconnect;
        
	# set the last read time
	$last_read_windows = time();
    
   
	$Log->Message('INFO',"FloodHash Data - Device Maintenance Windows - Found [$Count] Devices/Windows");
	$Log->Message('DEBUG',"FloodHash Data - Device Maintenance Windows - Device Dump\n-------------\n" . Dumper($WindowHash) . "\n-------------");
}

######################################################################################################
# Name: ReadMetatags
# Description: Fills the metatag hash after the last read checktime to populate the updated threshold
# values of parameters DetectionThreshold,PreventionThreshold and DefaultTimeWindow 
#  
######################################################################################################
our $last_read_metatags;
sub LibUtil_ReadMetatags() {

     my $Config = Assure1::Config->new({
    configPath => '/appl/oss/assure1/etc/Assure1.conf'});

        my $url = '/api/device/Devices';
        my $client = Assure1::API->new(
        {
            url => $url,
            sslClientCert => 1
        });


    my $url = '/api/device/Devices';
        my $client = Assure1::API->new(
        {
            url => $url,
            sslClientCert => 1
        });

	my $DeviceSQL = "SELECT ds.DNSName as DNSName, ds.DeviceID as DeviceID FROM Devices AS ds
  Left JOIN
  DeviceMetaData AS dm
  ON ds.DeviceID = dm.DeviceID
  left JOIN
  DeviceMetaTypes AS dt
  ON dt.DeviceMetaTypeID = dm.DeviceMetaTypeID  WHERE ((dt.DeviceMetaTypeName IN ('FloodPreventionThreshold','FloodDetectionThreshold','FloodTimeWindow')) AND dm.MetaData > 0)";
    $DBH = DBConnect($Config, 'Assure1', {AutoCommit => 1});
    my $Count = 0;
    my $SelectStatement = $DBH->prepare($DeviceSQL);
    $SelectStatement->execute();
    $PreventionMetatagsHash = ();
    $DetectionMetatagsHash = ();
    $deviceTimeWindow = ();

    while (my $ref = $SelectStatement->fetchrow_hashref()) {
        my $response     = $client->read(undef, {
                        filter       => [{
                                property => 'DeviceID',
                                operator => 'eq',
                                value    => $ref->{DeviceID}
                        }]
                });
        
        foreach my $element ( @{$response->{data}->[0]->{MetaData}} ) 
        {
            if ($element->{DeviceMetaTypeName} eq 'FloodPreventionThreshold')
            {
                    $PreventionMetatagsHash->{$ref->{DNSName}} = $element ->{MetaData};

            }
            if ($element->{DeviceMetaTypeName} eq 'FloodDetectionThreshold')
            {
                    $DetectionMetatagsHash->{$ref->{DNSName}} = $element ->{MetaData};

            }
            if ($element->{DeviceMetaTypeName} eq 'FloodTimeWindow')
                {
                                $deviceTimeWindow->{$ref->{DNSName}} = $element ->{MetaData};

                }
                }
        $Count++;
    }
    #$PreventionMetatagsHash->{''} = 0;
    #$DetectionMetatagsHash->{''} = 0;
    #$deviceTimeWindow->{''} = 0;

    $SelectStatement->finish();
    $DBH->disconnect;
    
    # set the last read time
    $last_read_metatags = time();
    $Log->Message('INFO',"FloodHash Data - Device PreventionMetatagsHash - Found [$Count] Devices/MetaData");
    $Log->Message('DEBUG',"FloodHash Data - Device PreventionMetatagsHash - Device Dump\n-------------\n" . Dumper($PreventionMetatagsHash) . "\n-------------");
    $Log->Message('DEBUG',"FloodHash Data - Device DetectionMetatagsHash - Device Dump\n-------------\n" . Dumper($DetectionMetatagsHash) . "\n-------------");
    $Log->Message('DEBUG',"FloodHash Data - Device Flood time window - Device Dump\n-------------\n" . Dumper($deviceTimeWindow) . "\n-------------");

}

######################################################################################################
# Name: LibUtil_RefreshMaintenanceWindows 
# Description: Refresh Maintenance window rules every $Checktime seconds
# Parameters: ...
######################################################################################################
sub LibUtil_RefreshMaintenanceWindows() {
	my $now_in_seconds = time();
	my $CheckTime = 60;
	$Log->Message('DEBUG', "NowInWindows " . $now_in_seconds . " LastReadWindows " . $last_read_windows . " CheckTime " . $CheckTime);
	if ($now_in_seconds > $last_read_windows + $CheckTime) {
		$Log->Message('DEBUG', "FloodHash Data - Device calling ReadMaintenanceWindows");
		my $rv = LibUtil_ReadMaintenanceWindows();
		$Log->Message('DEBUG', "FloodHash Data - Device ReadMaintenanceWindows returned $rv");
	}
    else{
    $Log->Message('DEBUG', "FloodHash Data - Device ReadMaintenanceWindows not refreshed ");
    }
}

######################################################################################################
# Name: LibUtil_RefreshMetatags 
# Description: Refresh Metatags rules every $Checktime seconds
# Parameters: ...
######################################################################################################
sub LibUtil_RefreshMetatags() {
	my $now_in_seconds = time();
	my $CheckTime = 120;
	$Log->Message('DEBUG', "NowInMetatags " . $now_in_seconds . " LastReadMetatags " . $last_read_metatags . " CheckTime " . $CheckTime);
	if ($now_in_seconds > $last_read_metatags + $CheckTime) {
		$Log->Message('DEBUG', "FloodHash Data - Device calling ReadMetatags");
		my $rv = LibUtil_ReadMetatags();
		$Log->Message('DEBUG', "FloodHash Data - Device ReadMetatags returned $rv");
	}
    else{
    $Log->Message('DEBUG', "FloodHash Data - Device ReadMetatag not refreshed ");
    }
}

######################################################################################################
# Name: LibUtil_MWValidation
# Description: ----
# Parameters: ....
######################################################################################################
sub LibUtil_MWValidation() {

	my $StartWindow = int($WindowHash->{$Event->{'Node'}}->{StartTime} || $WindowHash->{$Event->{'IPAddress'}}->{StartTime});
	my $EndWindow   = int($WindowHash->{$Event->{'Node'}}->{StopTime}  || $WindowHash->{$Event->{'IPAddress'}}->{StopTime});
	my $CurrentTime = time();
	if (($StartWindow <= $CurrentTime) && ($EndWindow >= $CurrentTime)) {

		$Log->Message('DEBUG',"FloodHash Data - Device Maintenance Windows for Node:::".$Event->{'Node'});
		$Event->{'Severity'}         = 0;
		$Event->{Details}->{Message} = "Under Maintenance";
		delete $IPFloodHash{$Event->{Node}};
		delete $EMSFloodHash{$Event->{EMSHost}};

    } else {
    	LibUtil_RefreshMaintenanceWindows();
        LibUtil_RefreshMetatags();
		H3A_FloodControl();
	}
}

######################################################################################################
# Name: LibUtil_RemoveSuppression 
# Parameters: a reference to the Event
#             a Name of Suppression,
#             a Key of Suppression
# Description: Updates the Event fields Suppression and SuppressionList
#              NOTE:  In case no futher suppression are active also Suppression is set to 0 (unsuppressed).
######################################################################################################
sub LibUtil_RemoveSuppression {
	my ($eventRef,$SuppName, $SuppKey) = @_;
      
    my $trace = '  LibUtil_RemoveSuppression';
   	$Log->Message('DEBUG', $trace . " started...");

	$Log->Message('DEBUG', $trace . " Arguments: Name='".$SuppName."', Key='".$SuppKey."'");
    
	my $actualSuppressionList;
	if (exists $eventRef->{SuppressionList}) {
		$actualSuppressionList = decode_json($eventRef->{SuppressionList});
	}

	# nothing todo - suppression name and key not found.
	if (! exists $actualSuppressionList->{$SuppName}->{$SuppKey}) {
    	$Log->Message('DEBUG', $trace . " ...done (no suppression found)");
		return;
	}

	#remove suppression key from hash
	delete $actualSuppressionList->{$SuppName}->{$SuppKey};
    
    #write journal
    if ( exists $eventRef->{EventID}) {
    	my ($ErrorFlag, $Message) = AddJournal({
			DBH       => \$EventDBH,
			EventID   =>  $eventRef->{EventID},
			TimeStamp => time,
			Username  => 'admin',
			Entry     => "Suppression '$SuppName' with Key '$SuppKey' removed.",
			ShardID   => $AppConfig->{'ShardID'}
		});
    }
    
    
	#remove SuppressionName in case no further SuppressionKeys exists
	if (scalar keys %{$actualSuppressionList->{$SuppName}} == 0 ) {
		delete $actualSuppressionList->{$SuppName};
	}
        
	$eventRef->{SuppressionList} = encode_json($actualSuppressionList);
        
	#set Suppresion to 0 in case no active Suppressions
	if (scalar keys %{$actualSuppressionList} == 0 ) {
		$eventRef->{Suppression} = 0;
		$eventRef->{LastComment} = 'Event Unsuppressed';
        
        #write journal
        if (exists $eventRef->{EventID} ) {
    		my ($ErrorFlag, $Message) = AddJournal({
				DBH       => \$EventDBH,
				EventID   =>  $eventRef->{EventID},
				TimeStamp => time,
				Username  => 'admin',
				Entry     => "Alarm unsuppressed",
				ShardID   => $AppConfig->{'ShardID'}
			});
		}
        
	}
	$Log->Message('DEBUG', $trace . " ...done");
}

######################################################################################################
# Name: LibUtil_SendSMS 
# Parameters: 	-) Receiver Phone Number
#				-) Text Message
#				-) Sender Phone Number
# Description: Makes a HTTPS call to SMS gateway to send SMS
######################################################################################################
sub LibUtil_SendSMS {
	my ($receiver, $message, $sender) = @_;
	#my $phone_number = shift ;
	#my $sms_message = shift ;
	#my $sender  = shift;

	my $trace = 'LibUtil_SendSMS';
	$Log->Message('INFO', $trace . ' started.');
    
	# Retrieve sms gateway env details
    my $envRef = LibUtil_GetEnvironmentalNVPs('smsgw');   
	my $host 		= $envRef->{'smsgw-hostname'} ;
	my $username 	= $envRef->{'smsgw-username'} ;
	my $password 	= $Config->passwordDecrypt($envRef->{'smsgw-password'}) ;

	my $strUser 	= $username;
	my $strPass 	= $password;
	my $strServer 	= $host;
	my $strPort 	= "443";
	my $strURL 		= "/smsgateway";
	my $timeout 	= 30;
	my $myConfig 	= new Assure1::Config;
	my $sslfile 	= $myConfig->{'BaseDir'} . '/etc/ssl/DreiAT.Bundle.cer';

	my $ua = LWP::UserAgent->new;
	$ua->agent("Test Agent");
	$ua->timeout($timeout);
	#$ua->ssl_opts(SSL_verify_mode => IO::Socket::SSL::SSL_VERIFY_NONE, verify_hostname => 0);
	$ua->ssl_opts(SSL_ca_file => $sslfile);

	if (!$receiver) { $Log->Message('WARN', 'Destinaton phone number not given for sending sms response '); }
	if (!$message) { $Log->Message('WARN', 'No Text given for sending sms ');}
	if (!$sender) { $sender='uUMS';} 


	my $strURL_with_param = "https://" . $strServer . ":" . $strPort . $strURL;
	$strURL_with_param   .= "?username=" . $strUser . "&pass=" . $strPass;
	$strURL_with_param   .= "&to=" . $receiver . "&from=" . $sender . "&text=" . $message;

	$Log->Message('DEBUG', $trace . ' SMS Gateway URL ' . $strURL_with_param);
    
	my $response = $ua->get($strURL_with_param);

	my $strResponseCode = $response->code;
	my $strMessage = $response->message;

	if (($strMessage !~/Accepted/ ) || ($strResponseCode != 202	)) {
		my $error_msg = "SMS notification error. Got the following RC: $strResponseCode Output: ${strMessage} (Parameter: to='$phone_number'; text='$sms_message'; from='$sender').";
		$Log->Message('ERROR',  $trace . " " .$error_msg);
		return (1, $error_msg);
	} else {
		my $msg = "SMS to $phone_number with text '$text' from $sender successfully sent. (Parameter: to='" . join ( " " , @opt_to_array) . "'; text='$sms_message'; from='$sender').";
		$Log->Message('INFO',  $trace . " " . $msg);
		return (0, $msg);
	}
}

######################################################################################################
# Name: LibUtil_SetAdditionalInfo 
# Parameters: 	a reference to the Event
#             	a Name of AdditionalInfo
# Description: Updates the Event fields AdditionalInfo
#              AdditionalInfo is treated as JSON with {"Name": "Value"} pairs.
######################################################################################################
sub LibUtil_SetAdditionalInfo {
	my ($eventRef,$name, $value) = @_;
    
    my $trace = '  LibUtil_SetAdditionalInfo';
	$Log->Message('DEBUG', $trace . " started...");
    
	my $actualAdditionalInfo;

	$Log->Message('DEBUG', "LibUtil_SetAdditionalInfo: Arguments: Name='".$name."', Value='".$value."'");
	if (exists $eventRef->{AdditionalInfo}) {
		# AddtionalInfo must be a JSON! we can't use eval on aggregator level. In order to minimize the risk the following check is introduced.
		# Check if AdditionalInfo is a possible JSON
		if ( $eventRef->{AdditionalInfo} =~ /^\{.*\}$/ ) {
			$actualAdditionalInfo = decode_json($eventRef->{AdditionalInfo});
		} else {
			$Log->Message('WARN', "Could not parse original AdditionalInfo JSON. (Value='".$eventRef->{AdditionalInfo}."'). Field will be overwritten! Check default value of AdditionalInfo field!!");
			$actualAdditionalInfo = decode_json ("{}");
		}; 
	}
	$actualAdditionalInfo->{$name} = $value;
	$eventRef->{AdditionalInfo} = encode_json($actualAdditionalInfo);
    
   	$Log->Message('DEBUG', $trace . " ...done");

}

# This functions adds an entry into DCI.t_fm_active_suppressions table
sub LibUtil_InsertActiveSuppression {
	$Log->Message('ERROR', "aignerma 2024-05-02: The function 'LibUtil_InsertActiveSuppression' is deprecated. Please use 'LibEnrichDCI_InsertActiveSuppression' instead. See also https://confluence.three.com/pages/viewpage.action?pageId=344102841#uUMSFMH3A_LibEnrichDCI(Functions)-LibEnrichDCI_InsertActiveSuppression");
    return; 
    
}

sub LibUtil_WriteJournal {
        my ($EventID, $journalText) = @_;
        if (exists $eventRef->{EventID} && defined $journalText) {
                my ($ErrorFlag, $Message) = AddJournal({
                        DBH       => \$EventDBH,
                        EventID   => $EventID,
                        TimeStamp => time(),
                        Username  => 'admin',
                        Entry     => $journalText,
                        ShardID   => $AppConfig->{'ShardID'}
                });
        }
}

# This subroutine is used to update an event in a database. It takes for arguments:
#	* $OrigEvent: A hash reference representing the original event.
#	* $UpdatedEvent: A hash reference representing the updated event.
#	* $Actor: Name of the Actor
#	* $Action: Name of the Action
# Description:
#	It compares the values in $OrigEvent and $UpdatedEvent and perfoms an SQL UPDATE statement to the Event.Events table in the database. Only the fields with changed values are updated. 
#	It also handles JSON fields and computes the differences between JSON documents. If no updates are found, it returns without making any changes.
#   Tt only checks the fields which are a given by the policy! 
sub LibUtil_UpdateEvent {
        my ($OrigEvent, $UpdatedEvent, $actor, $action) = @_;
        my $EventID = $UpdatedEvent->{EventID};
        my $trace = '  LibUtil_UpdateEvent';
         
        my %parameter;
		foreach my $field (keys %$UpdatedEvent) {
                # check if field value changed, as we only want to update the changed fields
                if ( ! exists $OrigEvent->{$field} ) {
					$Log->Message("ERROR", "Field '$field' is not found in the OrigEvent result hash and will not be updated. Check the SQL of this CAPE Policy. Might be this column is missing.");
                } else {
                	if ( $OrigEvent->{$field} ne $UpdatedEvent->{$field} ) {
                        # if JSON we need to findout how many JSON_DOCs are changed.
                        # use JSON_MERGE_PATCH if Orig field begins with '{'. 
                        if ($EventJSONFields{$field}{Type} eq 'JSON' && $OrigEvent->{$field}=~/^{/ ) {
                        		my @JSON_DOC_ARRAY = ();
                                @JSON_DOC_ARRAY = getJSONDifferences($OrigEvent->{$field},$UpdatedEvent->{$field},$EventJSONFields{$field}{CompareDepth});
                                $Log->Message("DEBUG", $trace . " Debug-01-001: Orig: ".$OrigEvent->{$field}." New: ".$UpdatedEvent->{$field}." JSON_DOC_ARRY " . Dumper(@JSON_DOC_ARRAY));
                                if (scalar @JSON_DOC_ARRAY > 0 ) {
                                	@{$parameter{$field}{JSONDOCARRAY}} = @JSON_DOC_ARRAY;
                                }
                        } else {
                                $parameter{$field} = $UpdatedEvent->{$field};
                        }
                	}
                }
        }
        
        # no updates found. 
        if (scalar keys %parameter == 0) {
        	return;
        }

		$parameter{LastChanged} = time;
        $parameter{Actor} = $actor;
        $parameter{Action} = $action;

        # create prepare statement
        my $preparedSQL = "UPDATE Event.Events set ";
        my @values = ();
        foreach my $param (keys %parameter) {
                $preparedSQL .= $param . "=";
                if ($EventJSONFields{$param}{Type} eq 'JSON' && $OrigEvent->{$param}=~/^{/ ) {
                        $preparedSQL .= "JSON_MERGE_PATCH(" . $param . "," . join(", ", map { "?" } @{$parameter{$param}{JSONDOCARRAY}}) . "),";
                        push @values, @{$parameter{$param}{JSONDOCARRAY}};
                } elsif ($param eq 'CAPEFlag') {
                		# do not overwrite CAPEFlag if already changed by another CAPE node
                		$preparedSQL .= "if(CAPEFlag = " . $OrigEvent->{$param} . ",?,CAPEFlag),";
                    	push @values, $parameter{$param};
                } else {
                        $preparedSQL .= "?,";
                        push @values, $parameter{$param};
                }
                #update OrigEvent
                $OrigEvent->{$param} = $UpdatedEvent->{$param};
        }
		chop ($preparedSQL);
        $preparedSQL .= " WHERE EventID = ?";
        push @values, $EventID;

        $Log->Message('DEBUG', "preparedSQL: " . $preparedSQL);
        $Log->Message('DEBUG', "Values: " . Dumper(@values));

		if (not exists $DATASOURCES{DCI} ) {
        	$Log->Message('WARN', $trace . " Global \$DATASOURCES{DCI} not defined correctly in CAPE Node. ");
        }
        LibMySQL_GetDBH_v2(\%{$DATASOURCES{DCI}});
		my $sth = $DATASOURCES{DCI}->{dbh}->prepare($preparedSQL) or $Log->Message('ERROR', "STH-ERR001 in prepare: return code: " . $sth->err . " error msg: " . $sth->errstr);
        $sth->execute(@values) or $Log->Message('ERROR', "STH-ERR002 in execute: return code: " . $sth->err . " error msg: " . $sth->errstr);
        $sth->finish;
}


# This subroutine is used to compare differences between two JSON documents. It takes three arguments:
#	* $oldJSON: The original JSON document.
#	* $newJSON: The new JSON document.
#	* $maxLevel: The maximum depth to compare within the JSON structure.
# Description:
#    It first attempts to parse the JSON documents, and if successful, it compares the JSON data structures. It uses _compare_data to find the differences, and it returns an array of JSON differences.
sub getJSONDifferences {
        my ($oldJSON, $newJSON, $maxLevel) = @_;
        my ($oldData, $newData, $level, $output);

        my @differences = ();

		eval {
                $oldData = decode_json($oldJSON);
                $newData = decode_json($newJSON);
        }; 

        if ($@) {
                $Log->Message('ERROR', "Could not parse JSON. Check the JSON fields! Received error: " . $@);
        } else {
                $level = 0;
                @differences = _compare_data($oldData, $newData, $level, $maxLevel);
        }
        return map "{". $_ ."}", @differences;
}

# This is a private subroutine used by getJSONDifferences to recursively compare JSON data structures. It takes four arguments:
#	* $oldData: The original data structure.
#	* $newData: The new data structure.
#	* $level: The current depth level.
#	* $maxLevel: The maximum depth to compare within the JSON structure.
# Description: 
#   The subroutine recursively compares the data structures and generates an array of differences between the two structures. It handles hash (object) and array (list) structures as well as scalar values.
sub _compare_data {
        my ($oldData, $newData,$level,$maxLevel) = @_;
        my @differences;

        if ( $level < $maxLevel ) {
                if (ref $oldData eq 'HASH' && ref $newData eq 'HASH') {
                        my %keys; # To keep track of encountered keys
                        for my $key (keys %$oldData, keys %$newData) {
                                next if $keys{$key}++;
                                if (!exists $oldData->{$key}) {
                                        push @differences, "\"$key\": ". encode_json($newData->{$key}) ."";
                                }
                                elsif (!exists $newData->{$key}) {
                                        push @differences, "\"$key\": null";
                                } else {
                                        my @sub_differences = _compare_data($oldData->{$key}, $newData->{$key}, $level + 1, $maxLevel);
                                        if ( ref $newData->{$key} eq 'HASH' ) {
                                                push @differences, map { "\"$key\": {$_}" } @sub_differences;
                                        } elsif (ref $newData->{$key} eq 'ARRAY' ) {
                                                push @differences, map { "\"$key\": $_" } @sub_differences;
                                        } else {
                                                push @differences, map { "\"$key\": $_" } @sub_differences;
                                        }
                                }
                        }
                } 
                elsif (ref $oldData eq 'HASH' && ref $newData eq 'ARRAY') {
						push @differences, encode_json($newData);
                }
                elsif (ref $oldData eq 'ARRAY' && ref $newData eq 'ARRAY') {
                        if (@$oldData != @$newData) {
                                push @differences, encode_json($newData); # 'Array sizes differ';
                        }
                        else {
                                my $diff=0;
                                for my $i (0 .. $#{$oldData}) {
                                        my @sub_differences = _compare_data($oldData->[$i], $newData->[$i], $level + 1, $maxLevel);
                                        if (@sub_differences) {
                                                $diff++;
                                        }
                                }
                                if ($diff>0) { 
                                        push @differences, encode_json($newData) 
                                };
                        }
                }
                elsif ($oldData ne $newData) {
                        push @differences, $newData;
                        #print "\n\ndebug: Values differ: '" . encode_json($oldData) . "' vs '" . encode_json($newData) ."'";
                }
        }
        return @differences;
}

# This may break depending on how $Config is defined HERE TN
sub  LibUtil_UnEncryptPassword {
	my $encryptedPassword = shift ;

	return $Config->passwordDecrypt($encryptedPassword) ;
}

1;